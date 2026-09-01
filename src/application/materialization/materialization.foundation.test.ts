import { describe, expect, it } from "vitest";
import type { ImportJob, ImportRecord } from "../import";
import {
  classifyCanonicalConflict,
  classifyIdentityConflicts,
  createImportSnapshotReference,
  groupByLogicalIdentity,
  logicalIdentityForValues,
  provenanceRelation,
  sourceSnapshotHash,
  verifyMaterializationRequest,
  type MaterializationRequest
} from "./index";

const source = {
  type: "EXCEL" as const,
  name: "برنامه سال 1405 واحد نت با تفکیک اقدامات.xlsx",
  metadata: { planYear: 1405, sheetName: "Sheet1", sheetIndex: 0 }
};

function record(id: string, entityType: ImportRecord["entityType"], data: Record<string, unknown>): ImportRecord {
  return {
    id,
    entityType,
    source,
    data,
    rowNumber: Number(id.replace(/\D/g, "")) || undefined,
    provenance: [{
      workbookName: source.name,
      sheetName: "Sheet1",
      sheetIndex: 0,
      headerRowIndex: 2,
      rowIndex: Number(id.replace(/\D/g, "")) || 1,
      sourceRowNumber: Number(id.replace(/\D/g, "")) || 1,
      column: "D",
      address: `${entityType === "objective" ? "D" : "C"}${Number(id.replace(/\D/g, "")) || 1}`,
      semanticType: entityType === "objective" ? "OBJECTIVE" : "GOAL",
      rawValue: data[entityType === "objective" ? "objective" : "goal"]
    }]
  };
}

function job(status: ImportJob["status"], records: ImportRecord[], analysisRevision = 1): ImportJob {
  return {
    id: "import-foundation-test",
    source,
    status,
    records,
    analysisRevision,
    createdAt: "2026-08-26T00:00:00.000Z"
  };
}

describe("R10-A logical identity", () => {
  it("uses parent context so identical objective titles under different goals remain distinct", () => {
    const first = logicalIdentityForValues("objective", 1405, { goal: "Goal A", objective: "Shared objective" });
    const second = logicalIdentityForValues("objective", 1405, { goal: "Goal B", objective: "Shared objective" });
    expect(first.key).not.toBe(second.key);
    expect(first.parentKey).not.toBe(second.parentKey);
  });

  it("normalizes equivalent Persian spellings and whitespace", () => {
    const first = logicalIdentityForValues("objective", 1405, { goal: "هدف كلی", objective: "  هدف\u200c جزئی  " });
    const second = logicalIdentityForValues("objective", 1405, { goal: "هدف کلی", objective: "هدف جزئی" });
    expect(first.key).toBe(second.key);
  });

  it("groups repeated source rows into one logical entity", () => {
    const records = [
      record("objective-1", "objective", { goal: "Goal", objective: "Objective" }),
      record("objective-2", "objective", { goal: "Goal", objective: "Objective" }),
      record("objective-3", "objective", { goal: "Goal", objective: "Other" })
    ];
    const groups = groupByLogicalIdentity(records, 1405);
    expect(groups.size).toBe(2);
    expect([...groups.values()].map((items) => items.length).sort()).toEqual([1, 2]);
  });

  it("preserves the known workbook invariant: 135 source objective rows become 44 concepts", () => {
    const records: ImportRecord[] = [];
    for (let concept = 1; concept <= 44; concept += 1) {
      const occurrences = concept <= 3 ? 4 : 3;
      for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
        records.push(record(`objective-${concept}-${occurrence}`, "objective", {
          goal: `Goal ${String((concept % 10) + 1)}`,
          objective: `Objective ${concept}`
        }));
      }
    }
    expect(records).toHaveLength(135);
    expect(groupByLogicalIdentity(records, 1405).size).toBe(44);
  });
});

describe("R10-A conflict model", () => {
  it("rejects conflicting values within one logical identity", () => {
    const records = [
      record("objective-1", "objective", { goal: "Goal", objective: "Objective" }),
      record("objective-2", "objective", { goal: "Goal", objective: "Objective", collaborator: "Different" })
    ];
    expect(classifyIdentityConflicts(records, 1405)).toEqual([]);
    const conflicting = [
      record("action-1", "action", { goal: "Goal", objective: "Objective", activity: "Activity", action: "Action", deliverable: "One" }),
      record("action-2", "action", { goal: "Goal", objective: "Objective", activity: "Activity", action: "Action", deliverable: "Two" })
    ];
    expect(classifyIdentityConflicts(conflicting, 1405)[0]).toMatchObject({ code: "IDENTITY_COLLISION", entityType: "action" });
  });

  it("rejects equivalent canonical entities originating from another import", () => {
    expect(classifyCanonicalConflict({
      entityType: "objective",
      identityKey: "objective|1405|goal|1405|goal|objective",
      sourceRecordIds: ["objective-1"],
      canonicalExists: true,
      equivalent: true,
      originatedByAnotherImport: true
    })[0]).toMatchObject({ code: "CANONICAL_CONFLICT" });
  });

  it("allows an absent identity and explicitly permitted equivalent reuse", () => {
    expect(classifyCanonicalConflict({
      entityType: "goal",
      identityKey: "goal|1405|goal",
      sourceRecordIds: ["goal-1"],
      canonicalExists: false,
      equivalent: false,
      originatedByAnotherImport: false
    })).toEqual([]);
    expect(classifyCanonicalConflict({
      entityType: "goal",
      identityKey: "goal|1405|goal",
      sourceRecordIds: ["goal-1"],
      canonicalExists: true,
      equivalent: true,
      originatedByAnotherImport: false
    })).toEqual([]);
  });
});

describe("R10-A snapshot contract", () => {
  it("is deterministic independent of source record order", () => {
    const records = [
      record("objective-2", "objective", { goal: "Goal", objective: "Two" }),
      record("objective-1", "objective", { goal: "Goal", objective: "One" })
    ];
    expect(sourceSnapshotHash(source, records)).toBe(sourceSnapshotHash(source, [...records].reverse()));
  });

  it("ignores irrelevant nested collection ordering", () => {
    const first = record("objective-1", "objective", { goal: "Goal", objective: "Objective", assignments: [{ entityId: "b" }, { entityId: "a" }] });
    const second = { ...first, provenance: [...first.provenance!].reverse(), data: { ...first.data, assignments: [{ entityId: "a" }, { entityId: "b" }] } };
    expect(sourceSnapshotHash(source, [first])).toBe(sourceSnapshotHash(source, [second]));
  });

  it("rejects non-approved imports", () => {
    const candidate = job("REVIEW_REQUIRED", [record("objective-1", "objective", { goal: "Goal", objective: "Objective" })]);
    expect(() => createImportSnapshotReference(candidate, 1405)).toThrow(/approved/);
  });

  it("rejects stale revisions and changed snapshots", () => {
    const approved = job("APPROVED", [record("objective-1", "objective", { goal: "Goal", objective: "Objective" })]);
    const snapshot = createImportSnapshotReference(approved, 1405);
    const request: MaterializationRequest = {
      importJobId: approved.id,
      approvedAnalysisRevision: 2,
      sourceSnapshotHash: snapshot.sourceSnapshotHash,
      actorId: "user-1",
      targetPlanYear: 1405
    };
    const changed = {
      ...approved,
      analysisRevision: 2,
      records: [record("objective-1", "objective", { goal: "Goal", objective: "Changed" })]
    };
    expect(verifyMaterializationRequest(changed, request, snapshot).map((item) => item.code))
      .toContain("SNAPSHOT_MISMATCH");
    expect(verifyMaterializationRequest(approved, { ...request, sourceSnapshotHash: "changed" }, snapshot).map((item) => item.code))
      .toEqual(expect.arrayContaining(["REVISION_MISMATCH", "SNAPSHOT_MISMATCH"]));
  });
});

describe("R10-A provenance contract", () => {
  it("supports source-to-canonical relation semantics and round-trip source evidence", () => {
    const sourceRecord = record("objective-1", "objective", { goal: "Goal", objective: "Objective" });
    const relation = provenanceRelation({
      relation: "CREATED_FROM",
      importJobId: "import-foundation-test",
      sourceRecord,
      canonicalEntityType: "objective",
      canonicalEntityId: "objective-1405-1"
    });
    expect(relation).toMatchObject({
      relation: "CREATED_FROM",
      importJobId: "import-foundation-test",
      sourceRecordId: "objective-1",
      canonicalEntityType: "objective",
      canonicalEntityId: "objective-1405-1"
    });
    expect(relation.source?.[0].address).toBe("D1");
  });
});
