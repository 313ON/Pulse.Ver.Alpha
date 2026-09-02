import type { Program } from "../../../domain/program";
import { ImportReadinessService, type ImportReadinessOptions } from "../ImportReadinessService";
import type { ImportRecord, ImportSource } from "../contracts";
import { InMemoryImportJobRepository, InMemoryImportRecordRepository } from "../adapters";
import type { ImportJobRepository, ImportRecordRepository } from "../ports";
import type { ImportJob, ImportJobStatus, ImportRemediationRecord } from "./ImportJob";
import type { GovernedProgramEvaluationResult } from "../../program/GovernedProgramEvaluationService";
import { ProductionGovernedProgramEvaluationService } from "../../program/ProductionGovernedProgramEvaluationService";
import type { SpreadsheetEvaluationReport } from "../spreadsheet/evaluation/contracts";
import {
  applyGoalOwnerOverlay,
  validateAssignGoalOwnerRemediation,
  type AssignGoalOwnerRemediationInput,
  GOAL_OWNER_REQUIRED_RULE
} from "../../../domain/program/governance/AssignGoalOwnerRemediation";
import type { SessionUser } from "../../../server/auth";

export type ImportApprovalResult = {
  ready: boolean;
  blockers: string[];
};

export type ImportRemediationPerson = { id: string; displayName: string };
export type ImportRemediationPersonPort = {
  getActivePerson(id: string): ImportRemediationPerson | undefined;
};

export class ImportReviewService {
  constructor(
    private readonly readiness: ImportReadinessService = new ImportReadinessService(),
    private readonly jobs: ImportJobRepository = new InMemoryImportJobRepository(),
    private readonly records: ImportRecordRepository = new InMemoryImportRecordRepository(),
    private readonly people?: ImportRemediationPersonPort
  ) {}

  createJob(source: ImportSource, id = `import-${Date.now()}`): ImportJob {
    const job: ImportJob = {
      id,
      source,
      status: "DRAFT",
      records: [],
      analysisRevision: 0,
      createdAt: new Date().toISOString()
    };
    return this.jobs.create(job);
  }

  getJob(id: string): ImportJob {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Import job "${id}" was not found.`);
    return this.withRecords(job);
  }

  attachRecords(id: string, records: ImportRecord[]): ImportJob {
    const job = this.getJob(id);
    this.requireStatus(job, "DRAFT");
    this.records.attach(id, records);
    return this.getJob(id);
  }

  analyze(
    id: string,
    program: Program,
    options: ImportReadinessOptions = {},
    evaluationResult?: SpreadsheetEvaluationReport,
    triggeringRemediationId?: string,
    expectedAnalysisRevision?: number
  ): ImportJob {
    if (options.organizationalGovernance) {
      throw new Error("Governed 10D evaluation must use evaluateGoverned and cannot persist evaluation results.");
    }
    const job = this.getJob(id);
    this.requireStatus(job, "DRAFT", "REVIEW_REQUIRED");
    this.jobs.updateStatus(id, "ANALYZING");
    const normalizedRecords = this.records.getByJobId(id);
    const validationResult = this.readiness.validate(normalizedRecords, options);
    const evaluation = this.readiness.evaluateProgram(program, options);
    const baseline = job.analysisBaseline ?? program;
    this.jobs.saveAnalysisResult(id, validationResult, {
      governance: evaluation.governance,
      findings: evaluation.assessment
    }, evaluation.qualityScore, evaluationResult, triggeringRemediationId, expectedAnalysisRevision, baseline);
    this.jobs.updateStatus(id, "REVIEW_REQUIRED");
    return this.getJob(id);
  }

  assignGoalOwner(
    id: string,
    program: Program,
    input: Omit<AssignGoalOwnerRemediationInput, "importJobId"> & {
      expectedAnalysisRevision: number;
      expectedOldOwner?: string;
      actor: SessionUser;
      ownerDisplayName: string;
    },
    sourceFinding: Record<string, unknown>,
    sourceProvenance?: Record<string, unknown>
  ): ImportJob {
    const job = this.getJob(id);
    this.requireStatus(job, "REVIEW_REQUIRED");
    const remediation = validateAssignGoalOwnerRemediation({
      importJobId: id,
      rule: input.rule,
      targetEntityType: input.targetEntityType,
      targetGoalId: input.targetGoalId,
      proposedOwnerPersonId: input.proposedOwnerPersonId,
      reason: input.reason
    });
    const finding = job.assessmentResult?.governance.errors.find((violation) =>
      violation.rule === GOAL_OWNER_REQUIRED_RULE && violation.entityId === remediation.targetGoalId
    );
    if (!finding) throw new Error("The requested governance finding was not found for this import.");
    if (sourceFinding.rule !== finding.rule || sourceFinding.entityId !== finding.entityId) {
      throw new Error("The requested governance finding does not belong to this import.");
    }
    const person = this.people?.getActivePerson(remediation.proposedOwnerPersonId);
    if (this.people && !person) throw new Error("The selected person does not exist or is inactive.");
    if (job.analysisRevision !== input.expectedAnalysisRevision) {
      throw new Error("The import review has changed. Reload the latest findings.");
    }
    if (!job.analysisBaseline) {
      throw new Error("This import has no immutable analysis baseline and cannot be remediated.");
    }
    const effectiveBaseline = this.applyActiveOverlays(job.analysisBaseline, job);
    const goal = effectiveBaseline.goals.find((candidate) => candidate.id === remediation.targetGoalId);
    if (!goal) throw new Error("The requested governance finding target was not found.");
    const oldOwner = goal.owner.trim();
    if (input.expectedOldOwner !== undefined && input.expectedOldOwner !== oldOwner) {
      throw new Error("The import review has changed. Reload the latest findings.");
    }
    const record: ImportRemediationRecord = {
      id: `remediation-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      importJobId: id,
      rule: remediation.rule,
      targetEntityType: remediation.targetEntityType,
      targetEntityId: remediation.targetGoalId,
      oldEffectiveOwner: oldOwner || undefined,
      proposedOwnerId: remediation.proposedOwnerPersonId,
      ownerDisplayName: person?.displayName ?? input.ownerDisplayName,
      reason: remediation.reason,
      sourceFinding,
      sourceProvenance,
      actorUserId: input.actor.id,
      expectedAnalysisRevision: input.expectedAnalysisRevision,
      status: "APPLIED",
      createdAt: new Date().toISOString()
    };
    const effectiveProgram = applyGoalOwnerOverlay(
      effectiveBaseline,
      remediation.targetGoalId,
      person?.displayName ?? input.ownerDisplayName
    );
    const result = this.analyze(id, effectiveProgram, {}, undefined, record.id, input.expectedAnalysisRevision);
    this.jobs.createRemediation({ ...record, resultingAnalysisRevision: result.analysisRevision });
    return this.getJob(id);
  }

  evaluateGoverned(
    program: Program,
    user: SessionUser,
    generatedAt: string
  ): GovernedProgramEvaluationResult {
    return new ProductionGovernedProgramEvaluationService().evaluate(program, user, generatedAt);
  }

  approvalReadiness(id: string): ImportApprovalResult {
    const job = this.getJob(id);
    const blockers: string[] = [];
    if (!job.validationResult || !job.assessmentResult || !job.qualityScore) {
      blockers.push("Import job must be analyzed before approval.");
      return { ready: false, blockers };
    }
    if (job.validationResult.errors.some((error) => error.code === "INVALID_DATE")) {
      blockers.push("Invalid dates must be corrected before approval.");
    }
    const classification = job.source.metadata.classification;
    if (typeof classification === "string" && classification !== "CANONICAL") {
      return { ready: blockers.length === 0, blockers };
    }
    if (job.assessmentResult.governance.errors.some((violation) => this.isCriticalGovernanceViolation(violation.rule))) {
      blockers.push("Critical governance violations must be resolved before approval.");
    }
    if (job.qualityScore.dimensions.hierarchy < 100 || job.qualityScore.findings.some((finding) => finding.dimension === "hierarchy" && finding.severity === "error")) {
      blockers.push("Broken hierarchy must be resolved before approval.");
    }
    if (job.assessmentResult.findings.some((finding) =>
      finding.code === "ACTIVITY_WITHOUT_RESPONSIBLE_EXECUTOR"
      || finding.code === "MISSING_COLLABORATION_COVERAGE" && finding.severity === "error"
    )) {
      blockers.push("Mandatory responsibility requirements must be resolved before approval.");
    }
    return { ready: blockers.length === 0, blockers };
  }

  approve(id: string, expectedAnalysisRevision?: number): ImportJob {
    const job = this.getJob(id);
    this.requireStatus(job, "REVIEW_REQUIRED");
    if (expectedAnalysisRevision !== undefined && (job.analysisRevision ?? 0) !== expectedAnalysisRevision) {
      throw new Error("The import review has changed. Reload the latest findings.");
    }
    const readiness = this.approvalReadiness(id);
    if (!readiness.ready) throw new Error(readiness.blockers.join(" "));
    return this.getJob(this.jobs.updateStatus(id, "APPROVED", new Date().toISOString(), expectedAnalysisRevision).id);
  }

  reject(id: string): ImportJob {
    const job = this.getJob(id);
    this.requireStatus(job, "REVIEW_REQUIRED", "ANALYZING");
    return this.getJob(this.jobs.updateStatus(id, "REJECTED").id);
  }

  private withRecords(job: ImportJob): ImportJob {
    return {
      ...job,
      records: this.records.getByJobId(job.id),
      analysisRevisions: this.jobs.getAnalysisRevisions(job.id),
      remediations: this.jobs.listRemediations(job.id)
    };
  }

  private isCriticalGovernanceViolation(rule: string): boolean {
    // Goal ownership is execution accountability, not approval authority.
    // Keep the finding visible for data-quality review, but never make it an
    // approval prerequisite by itself.
    if (rule === GOAL_OWNER_REQUIRED_RULE) return false;
    return rule.startsWith("program.")
      || rule.startsWith("goal.")
      || rule.startsWith("objective.")
      || rule.startsWith("activity.")
      || rule.startsWith("action.")
      || rule.startsWith("kpi.")
      || rule.startsWith("assignment.")
      || rule.startsWith("status.");
  }

  private applyActiveOverlays(program: Program, job: ImportJob): Program {
    return (job.remediations ?? [])
      .filter((remediation) => remediation.status === "APPLIED" && remediation.resultingAnalysisRevision !== undefined)
      .reduce(
        (current, remediation) => applyGoalOwnerOverlay(current, remediation.targetEntityId, remediation.ownerDisplayName),
        structuredClone(program)
      );
  }

  private requireStatus(job: ImportJob, ...statuses: ImportJobStatus[]) {
    if (!statuses.includes(job.status)) {
      throw new Error(`Import job "${job.id}" must be in ${statuses.join(" or ")} status.`);
    }
  }
}
