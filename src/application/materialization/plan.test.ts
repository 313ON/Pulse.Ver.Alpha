import { describe, expect, it } from "vitest";
import type { ImportJob, ImportRecord } from "../import";
import { createImportSnapshotReference } from "./snapshot";
import { buildMaterializationPlan, materializationPlanHash, type MaterializationPlanInput } from "./plan";

const source = { type: "EXCEL" as const, name: "fixture.xlsx", metadata: { planYear: 1405, sheetIndex: 0 } };
function record(id: string, entityType: ImportRecord["entityType"], data: Record<string, unknown>, rowNumber = 1): ImportRecord {
  return { id, entityType, data, source, rowNumber, provenance: [{ workbookName: source.name, sheetName: "Sheet1", sheetIndex: 0, headerRowIndex: 1, rowIndex: rowNumber, sourceRowNumber: rowNumber, column: "A", address: `A${rowNumber}`, rawValue: data[entityType] }] };
}
function job(records: ImportRecord[], status: ImportJob["status"] = "APPROVED"): ImportJob {
  return { id: "import-plan-test", source, records, status, analysisRevision: 3, approvedAt: "2026-08-26T00:00:00.000Z", createdAt: "2026-08-26T00:00:00.000Z" };
}
function input(records: ImportRecord[], status: ImportJob["status"] = "APPROVED"): MaterializationPlanInput {
  const candidate = job(records, status);
  const snapshot = createImportSnapshotReference(candidate, 1405);
  return { importJob: candidate, snapshot, request: { importJobId: candidate.id, approvedAnalysisRevision: 3, sourceSnapshotHash: snapshot.sourceSnapshotHash, targetPlanYear: 1405 }, planYear: 1405 };
}

describe("R10-C governed materialization plan", () => {
  it("builds a deterministic hierarchy and hash without side effects", () => {
    const records = [
      record("a1", "action", { goal: "G", objective: "O", activity: "A", action: "Do", deliverable: "D", startDate: "1405/01/01", endDate: "1405/02/01", workType: "اقدام", status: "شروع نشده" }, 4),
      record("o1", "objective", { goal: "G", objective: "O" }, 2),
      record("g1", "goal", { goal: "G" }, 1),
      record("ac1", "activity", { goal: "G", objective: "O", activity: "A" }, 3)
    ];
    const first = buildMaterializationPlan(input(records));
    const second = buildMaterializationPlan(input([...records].reverse()));
    expect(first.status).toBe("READY");
    expect(first.summary).toMatchObject({ goals: 1, objectives: 1, activities: 1, workItems: 1, sourceRecords: 4 });
    expect(first.planHash).toBe(second.planHash);
    const { planHash, ...withoutHash } = first;
    expect(materializationPlanHash(withoutHash)).toBe(planHash);
    expect(first.items.every((item) => item.sourceRecords.length > 0)).toBe(true);
  });

  it("preserves duplicate contributions and blocks conflicting values", () => {
    const equivalent = buildMaterializationPlan(input([
      record("g1", "goal", { goal: "G" }),
      record("o1", "objective", { goal: "G", objective: "O" }),
      record("o2", "objective", { goal: "G", objective: "O" })
    ]));
    expect(equivalent.status).toBe("READY");
    expect(equivalent.summary.objectives).toBe(1);
    expect(equivalent.items.find((item) => item.entityType === "objective")?.sourceRecords).toHaveLength(2);

    const conflicting = buildMaterializationPlan(input([
      record("g1", "goal", { goal: "G" }),
      record("o1", "objective", { goal: "G", objective: "O", description: "one" }),
      record("o2", "objective", { goal: "G", objective: "O", description: "two" })
    ]));
    expect(conflicting.status).toBe("BLOCKED");
    expect(conflicting.errors.some((item) => item.code === "IDENTITY_COLLISION")).toBe(true);
  });

  it("rejects unapproved snapshots and missing parents", () => {
    const approvedCandidate = job([record("o1", "objective", { goal: "Missing", objective: "O" })]);
    const snapshot = createImportSnapshotReference(approvedCandidate, 1405);
    const unapproved = buildMaterializationPlan({
      importJob: { ...approvedCandidate, status: "REVIEW_REQUIRED" },
      snapshot,
      request: { importJobId: approvedCandidate.id, approvedAnalysisRevision: 3, sourceSnapshotHash: snapshot.sourceSnapshotHash, targetPlanYear: 1405 },
      planYear: 1405
    });
    expect(unapproved.status).toBe("BLOCKED");
    expect(unapproved.errors.map((item) => item.code)).toEqual(expect.arrayContaining(["NOT_APPROVED", "MISSING_PARENT"]));
  });

  it("blocks unresolved responsibility and invalid required work-item fields", () => {
    const candidate = job([
      record("g1", "goal", { goal: "G" }),
      record("a1", "action", { goal: "G", objective: "O", activity: "A", action: "Do", status: "bad", workType: "bad", owner: "Unknown" })
    ]);
    const snapshot = createImportSnapshotReference(candidate, 1405);
    const plan = buildMaterializationPlan({
      importJob: candidate,
      snapshot,
      request: { importJobId: candidate.id, approvedAnalysisRevision: 3, sourceSnapshotHash: snapshot.sourceSnapshotHash, targetPlanYear: 1405 },
      planYear: 1405,
      responsibility: { resolvePerson: () => ({ field: "owner", resolved: false, reason: "Unknown person" }), resolveUnit: () => ({ field: "department", resolved: false, reason: "Unknown unit" }) }
    });
    expect(plan.status).toBe("BLOCKED");
    expect(plan.errors.some((item) => item.targetType === "PERSON")).toBe(true);
    expect(plan.errors.some((item) => item.field === "workType")).toBe(true);
  });
});
