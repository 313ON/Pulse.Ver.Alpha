import { auditMutation, ensureRuntimeData, handleApiError, json, readJson, requireCsrf, requirePermission } from "../../../_lib";
import { PersonRepository } from "../../../../../server/repositories";
import { SQLiteImportJobRepository, SQLiteImportRecordRepository } from "../../../../../server/import/SQLiteImportRepositories";
import { ImportReviewService } from "../../../../../application/import/staging";
import { GOAL_OWNER_REQUIRED_RULE } from "../../../../../domain/program/governance/AssignGoalOwnerRemediation";
import { RepositoryError } from "../../../../../server/repositories";
import { getDatabase } from "../../../../../server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    ensureRuntimeData();
    await requirePermission("imports.manage");
    const id = (await params).id;
    const jobs = new SQLiteImportJobRepository();
    const service = new ImportReviewService(undefined, jobs, new SQLiteImportRecordRepository());
    const job = service.getJob(id);
    return json({ people: new PersonRepository().list(), remediations: job.remediations ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    ensureRuntimeData();
    const actor = await requirePermission("imports.manage");
    await requireCsrf(request);
    const id = (await params).id;
    const body = await readJson(request, { csrf: false });
    const rule = body.rule;
    if (rule !== GOAL_OWNER_REQUIRED_RULE) {
      throw new RepositoryError("VALIDATION", "Only goal.owner.required remediation is supported.");
    }
    const targetGoalId = typeof body.targetGoalId === "string" ? body.targetGoalId : "";
    const proposedOwnerPersonId = typeof body.proposedOwnerPersonId === "string" ? body.proposedOwnerPersonId : "";
    const reason = typeof body.reason === "string" ? body.reason : "";
    const expectedAnalysisRevision = Number(body.expectedAnalysisRevision);
    const expectedOldOwner = typeof body.expectedOldOwner === "string" ? body.expectedOldOwner : undefined;
    if (!Number.isInteger(expectedAnalysisRevision) || expectedAnalysisRevision < 1) {
      throw new RepositoryError("VALIDATION", "The current analysis revision is required.");
    }
    const person = new PersonRepository().list().find((candidate) => String((candidate as { id: string }).id) === proposedOwnerPersonId);
    if (!person) throw new RepositoryError("VALIDATION", "The selected person does not exist or is inactive.");
    const jobs = new SQLiteImportJobRepository();
    const records = new SQLiteImportRecordRepository();
    const activePeople = new PersonRepository().list() as Array<{ id: string; full_name: string }>;
    const service = new ImportReviewService(undefined, jobs, records, {
      getActivePerson: (personId) => {
        const person = activePeople.find((candidate) => candidate.id === personId);
        return person ? { id: person.id, displayName: person.full_name } : undefined;
      }
    });
    const before = service.getJob(id);
    if (!before.analysisBaseline) {
      throw new RepositoryError("VALIDATION", "This import has no immutable analysis baseline.");
    }
    const baseline = before.analysisBaseline;
    const finding = before.assessmentResult?.governance.errors.find((violation) =>
      violation.rule === GOAL_OWNER_REQUIRED_RULE && violation.entityId === targetGoalId
    );
    if (!finding) throw new RepositoryError("NOT_FOUND", "The requested governance finding was not found.");
    const sourceRecord = before.records.find((record) => record.data.goal === targetGoalId);
    const result = getDatabase().transaction(() => {
      const remediated = service.assignGoalOwner(
        id,
        baseline,
        {
          rule: GOAL_OWNER_REQUIRED_RULE,
          targetEntityType: "goal",
          targetGoalId,
          proposedOwnerPersonId,
          reason,
          expectedAnalysisRevision,
          expectedOldOwner,
          actor,
          ownerDisplayName: String((person as { full_name?: string }).full_name ?? proposedOwnerPersonId)
        },
        finding,
        sourceRecord?.provenance?.[0]
      );
      auditMutation(actor, "import-remediation", id, "goal_owner_assigned", {
        importJobId: id,
        rule: GOAL_OWNER_REQUIRED_RULE,
        targetGoalId,
        oldEffectiveOwner: remediated.remediations?.at(-1)?.oldEffectiveOwner ?? null,
        expectedAnalysisRevision,
        sourceFinding: finding,
        reason
      }, {
        proposedOwnerPersonId,
        ownerDisplayName: String((person as { full_name?: string }).full_name ?? proposedOwnerPersonId),
        resultingAnalysisRevision: remediated.analysisRevision,
        governanceState: remediated.assessmentResult?.governance.valid ? "PASS" : "BLOCKED"
      });
      return remediated;
    })();
    return json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "The import review has changed. Reload the latest findings.") {
      return json({ error: error.message, code: "CONFLICT" }, { status: 409 });
    }
    return handleApiError(error);
  }
}
