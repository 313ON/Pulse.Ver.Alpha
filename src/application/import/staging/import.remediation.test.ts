import { describe, expect, it } from "vitest";
import { programFixture } from "../../../domain/program/program.fixture";
import type { Program } from "../../../domain/program";
import type { Assignment } from "../../../domain/program/Assignment";
import type { ImportRecord, ImportSource } from "../contracts";
import { InMemoryImportJobRepository, InMemoryImportRecordRepository } from "../adapters";
import type { SessionUser } from "../../../server/auth";
import { ImportReviewService } from "./ImportReviewService";

const source: ImportSource = { type: "EXCEL", name: "remediation.xlsx", metadata: {} };
const actor: SessionUser = { id: "user-1", username: "reviewer", role: "ADMIN", scope: "COMPANY" };
const targetGoalId = "goal-it-infrastructure";
const otherGoalId = "goal-process-excellence";

function remediationProgram(): Program {
  const program = structuredClone(programFixture);
  const assignment = (id: string, entityId: string, displayName: string, entityType: Assignment["entityType"]): Assignment => ({
    id,
    entityId,
    displayName,
    entityType,
    role: "EXECUTOR",
    responsibilityType: "PRIMARY"
  });
  for (const goal of program.goals) goal.owner = "";
  for (const goal of program.goals) {
    for (const objective of goal.objectives) {
      for (const activity of objective.activities) {
        activity.assignments = [assignment(`${activity.id}-assignment`, "unit-it", "IT", "UNIT")];
        for (const action of activity.actions) {
          action.assignments = [assignment(`${action.id}-assignment`, "person-1", "Person One", "PERSON")];
        }
      }
    }
  }
  return program;
}

function records(): ImportRecord[] {
  return [{
    id: "record-goal-1",
    entityType: "goal",
    source,
    data: { goal: targetGoalId, title: "Goal one" },
    provenance: [{
      workbookName: source.name,
      sheetName: "Program",
      sheetIndex: 0,
      rowIndex: 1,
      sourceRowNumber: 2,
      column: "A",
      address: "A2",
      rawValue: "G01",
      semanticType: "GOAL"
    }]
  }];
}

function setup() {
  const jobs = new InMemoryImportJobRepository();
  const recordRepository = new InMemoryImportRecordRepository();
  const service = new ImportReviewService(undefined, jobs, recordRepository, {
    getActivePerson: (id) => id === "person-1" ? { id, displayName: "Person One" } : undefined
  });
  service.createJob(source, "remediation-job");
  service.attachRecords("remediation-job", records());
  const program = remediationProgram();
  service.analyze("remediation-job", program);
  return { service, jobs, program };
}

describe("import-scoped goal owner remediation", () => {
  it("creates a new analysis, preserves evidence, and removes only the selected blocker", () => {
    const { service, jobs, program } = setup();
    const before = service.getJob("remediation-job");
    const finding = before.assessmentResult!.governance.errors.find((item) => item.rule === "goal.owner.required" && item.entityId === targetGoalId)!;
    const result = service.assignGoalOwner("remediation-job", program, {
      rule: "goal.owner.required",
      targetEntityType: "goal",
      targetGoalId,
      proposedOwnerPersonId: "person-1",
      reason: "تأیید مسئول هدف",
      expectedAnalysisRevision: before.analysisRevision!,
      expectedOldOwner: "",
      actor,
      ownerDisplayName: "Person One"
    }, finding, records()[0].provenance?.[0]);

    expect(result.analysisRevision).toBe(2);
    expect(result.records).toEqual(records());
    expect(result.assessmentResult?.governance.errors).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: "goal.owner.required", entityId: targetGoalId })
    ]));
    expect(result.assessmentResult?.governance.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: "goal.owner.required", entityId: otherGoalId })
    ]));
    expect(jobs.getAnalysisRevisions("remediation-job")).toHaveLength(2);
    expect(jobs.listRemediations("remediation-job")[0]).toMatchObject({
      targetEntityId: targetGoalId,
      resultingAnalysisRevision: 2,
      proposedOwnerId: "person-1"
    });
  });

  it("re-analyzes from the immutable import baseline after canonical data changes", () => {
    const { service, program } = setup();
    const before = service.getJob("remediation-job");
    const finding = before.assessmentResult!.governance.errors.find((item) =>
      item.rule === "goal.owner.required" && item.entityId === targetGoalId
    )!;
    const baselineOwner = before.analysisBaseline!.goals.find((goal) => goal.id === targetGoalId)!.owner;
    program.goals.find((goal) => goal.id === targetGoalId)!.owner = "Canonical Owner Changed Later";

    const result = service.assignGoalOwner("remediation-job", program, {
      rule: "goal.owner.required",
      targetEntityType: "goal",
      targetGoalId,
      proposedOwnerPersonId: "person-1",
      reason: "use imported review baseline",
      expectedAnalysisRevision: before.analysisRevision!,
      expectedOldOwner: baselineOwner,
      actor,
      ownerDisplayName: "Person One"
    }, finding, records()[0].provenance?.[0]);

    expect(result.analysisBaseline!.goals.find((goal) => goal.id === targetGoalId)?.owner).toBe(baselineOwner);
    expect(result.analysisRevisions?.[0].assessmentResult.governance.errors).toEqual(
      before.analysisRevisions?.[0].assessmentResult.governance.errors
    );
    expect(result.remediations?.[0].oldEffectiveOwner).toBe(baselineOwner || undefined);
    expect(program.goals.find((goal) => goal.id === targetGoalId)?.owner).toBe("Canonical Owner Changed Later");
  });

  it("rejects missing or inactive people", () => {
    const { service, program } = setup();
    const job = service.getJob("remediation-job");
    const finding = job.assessmentResult!.governance.errors.find((item) => item.rule === "goal.owner.required" && item.entityId === targetGoalId)!;
    expect(() => service.assignGoalOwner("remediation-job", program, {
      rule: "goal.owner.required",
      targetEntityType: "goal",
      targetGoalId,
      proposedOwnerPersonId: "missing",
      reason: "reason",
      expectedAnalysisRevision: job.analysisRevision!,
      actor,
      ownerDisplayName: "Missing"
    }, finding)).toThrow("does not exist or is inactive");
  });

  it("rejects a stale revision and stale old value", () => {
    const { service, program } = setup();
    const job = service.getJob("remediation-job");
    const finding = job.assessmentResult!.governance.errors.find((item) => item.rule === "goal.owner.required" && item.entityId === targetGoalId)!;
    expect(() => service.assignGoalOwner("remediation-job", program, {
      rule: "goal.owner.required",
      targetEntityType: "goal",
      targetGoalId,
      proposedOwnerPersonId: "person-1",
      reason: "reason",
      expectedAnalysisRevision: 99,
      actor,
      ownerDisplayName: "Person One"
    }, finding)).toThrow("review has changed");
    expect(() => service.assignGoalOwner("remediation-job", program, {
      rule: "goal.owner.required",
      targetEntityType: "goal",
      targetGoalId,
      proposedOwnerPersonId: "person-1",
      reason: "reason",
      expectedAnalysisRevision: job.analysisRevision!,
      expectedOldOwner: "someone-else",
      actor,
      ownerDisplayName: "Person One"
    }, finding)).toThrow("review has changed");
  });

  it("cannot apply a remediation or approval against a stale revision", () => {
    const { service, program } = setup();
    const before = service.getJob("remediation-job");
    const staleRevision = before.analysisRevision!;
    const finding = before.assessmentResult!.governance.errors.find((item) =>
      item.rule === "goal.owner.required" && item.entityId === targetGoalId
    )!;
    service.assignGoalOwner("remediation-job", program, {
      rule: "goal.owner.required",
      targetEntityType: "goal",
      targetGoalId,
      proposedOwnerPersonId: "person-1",
      reason: "first remediation",
      expectedAnalysisRevision: staleRevision,
      expectedOldOwner: "",
      actor,
      ownerDisplayName: "Person One"
    }, finding);

    const current = service.getJob("remediation-job");
    const otherFinding = current.assessmentResult!.governance.errors.find((item) =>
      item.rule === "goal.owner.required" && item.entityId === otherGoalId
    )!;
    expect(() => service.assignGoalOwner("remediation-job", program, {
      rule: "goal.owner.required",
      targetEntityType: "goal",
      targetGoalId: otherGoalId,
      proposedOwnerPersonId: "person-1",
      reason: "stale remediation",
      expectedAnalysisRevision: staleRevision,
      expectedOldOwner: "",
      actor,
      ownerDisplayName: "Person One"
    }, otherFinding)).toThrow("review has changed");

    expect(() => service.approve("remediation-job", staleRevision))
      .toThrow("review has changed");
  });

  it("requires the source finding to match the current import", () => {
    const { service, program } = setup();
    const job = service.getJob("remediation-job");
    expect(() => service.assignGoalOwner("remediation-job", program, {
      rule: "goal.owner.required",
      targetEntityType: "goal",
      targetGoalId,
      proposedOwnerPersonId: "person-1",
      reason: "reason",
      expectedAnalysisRevision: job.analysisRevision!,
      actor,
      ownerDisplayName: "Person One"
    }, { rule: "goal.owner.required", entityId: "other-goal" })).toThrow("does not belong");
  });

  it("does not make approval depend on unrelated goal owner findings", () => {
    const { service, program } = setup();
    const job = service.getJob("remediation-job");
    const finding = job.assessmentResult!.governance.errors.find((item) => item.rule === "goal.owner.required" && item.entityId === targetGoalId)!;
    service.assignGoalOwner("remediation-job", program, {
      rule: "goal.owner.required",
      targetEntityType: "goal",
      targetGoalId,
      proposedOwnerPersonId: "person-1",
      reason: "reason",
      expectedAnalysisRevision: job.analysisRevision!,
      expectedOldOwner: "",
      actor,
      ownerDisplayName: "Person One"
    }, finding);
    expect(service.approvalReadiness("remediation-job")).toEqual({ ready: true, blockers: [] });
  });

  it("allows approval only after every critical goal owner finding is remediated", () => {
    const { service, program } = setup();
    const effectiveProgram = structuredClone(program);
    for (const goal of effectiveProgram.goals) {
      const job = service.getJob("remediation-job");
      const finding = job.assessmentResult!.governance.errors.find((item) =>
        item.rule === "goal.owner.required" && item.entityId === goal.id
      );
      if (!finding) continue;
      service.assignGoalOwner("remediation-job", effectiveProgram, {
        rule: "goal.owner.required",
        targetEntityType: "goal",
        targetGoalId: goal.id,
        proposedOwnerPersonId: "person-1",
        reason: "reason",
        expectedAnalysisRevision: job.analysisRevision!,
        expectedOldOwner: goal.owner,
        actor,
        ownerDisplayName: "Person One"
      }, finding);
      goal.owner = "Person One";
    }
    expect(service.approvalReadiness("remediation-job")).toEqual({ ready: true, blockers: [] });
    expect(service.approve("remediation-job").status).toBe("APPROVED");
  });
});
