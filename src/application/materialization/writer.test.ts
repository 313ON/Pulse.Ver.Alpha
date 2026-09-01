import { afterEach, beforeEach, describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { closeDatabase, getDatabase } from "../../server/db";
import { applyMaterializationFoundationMigration } from "../../server/materialization/migration";
import { SQLiteMaterializationRepository } from "../../server/materialization/SQLiteMaterializationRepository";
import { materializationPlanHash, type MaterializationPlan, type MaterializationPlanItem } from "./plan";
import { SQLiteCanonicalMaterializationWriter, type MaterializeCanonicalPlanCommand, type MaterializationWriterFailurePoint } from "./writer";

let databasePath = "";

beforeEach(() => {
  closeDatabase();
  databasePath = path.join(os.tmpdir(), `pulse-r10d-${Date.now()}-${Math.random()}.sqlite`);
  process.env.PULSE_DB_PATH = databasePath;
});

afterEach(() => closeDatabase());

const provenance = (id: string) => [{
  workbookName: "isolated.xlsx", sheetName: "Sheet1", sheetIndex: 0,
  headerRowIndex: 1, rowIndex: 2, sourceRowNumber: 2, column: "A",
  address: "A2", rawValue: id
}];

function item(entityType: MaterializationPlanItem["entityType"], key: string, ordinal: number, parent: MaterializationPlanItem["parent"], values: Record<string, unknown> = {}): MaterializationPlanItem {
  const sourceId = `${entityType}-${ordinal}`;
  return {
    entityType,
    logicalIdentity: { entityType, logicalKey: key, title: `${entityType}-${ordinal}`, planYear: 1405 },
    parent,
    sourceRecords: [{
      recordId: sourceId, entityType, rowNumber: ordinal,
      source: { type: "EXCEL", name: "isolated.xlsx", metadata: { sheetName: "Sheet1", sheetIndex: 0, planYear: 1405 } },
      provenance: provenance(sourceId)
    }],
    normalizedValues: values,
    responsibility: entityType === "action"
      ? [
        { field: "owner", resolved: true, targetType: "PERSON", targetId: "person-1" },
        { field: "department", resolved: true, targetType: "UNIT", targetId: "dept-1" }
      ] : [],
    ordering: { ordinal, sourceSheetIndex: 0, sourceRow: ordinal, sourceRecordId: sourceId },
    canonicalAllocation: {
      ordinal,
      publicIdInput: entityType === "action" ? `G01-O01-A01-T${String(ordinal).padStart(3, "0")}` : undefined
    },
    conflictState: "NONE",
    provenanceReferences: [{ relation: "CREATED_FROM", sourceRecordId: sourceId }]
  };
}

function plan(): MaterializationPlan {
  const goal = item("goal", "goal|1405|goal-one", 1, undefined);
  const objective = item("objective", "objective|1405|goal-one|objective-one", 1, {
    relation: "PARENT", entityType: "goal", logicalKey: goal.logicalIdentity.logicalKey, title: goal.logicalIdentity.title, planYear: 1405
  });
  const activity = item("activity", "activity|1405|goal-one|objective-one|activity-one", 1, {
    relation: "PARENT", entityType: "objective", logicalKey: objective.logicalIdentity.logicalKey, title: objective.logicalIdentity.title, planYear: 1405
  });
  const action = item("action", "action|1405|goal-one|objective-one|activity-one|action-one", 1, {
    relation: "PARENT", entityType: "activity", logicalKey: activity.logicalIdentity.logicalKey, title: activity.logicalIdentity.title, planYear: 1405
  }, {
    action: "action-1", deliverable: "deliverable", startDate: "1405-01-01", endDate: "1405-01-02",
    workType: "اقدام", status: "پیش‌نویس", description: "description", assignments: [{ entityType: "PERSON", entityId: "person-1" }]
  });
  const items = [goal, objective, activity, action];
  const base = {
    status: "READY" as const, importJobId: "import-r10d", approvedAnalysisRevision: 1,
    sourceSnapshot: { importJobId: "import-r10d", approvedAnalysisRevision: 1, sourceSnapshotHash: "snapshot-r10d", targetPlanYear: 1405, sourceRecordCount: 4 },
    planYear: 1405, items,
    summary: { goals: 1, objectives: 1, activities: 1, workItems: 1, sourceRecords: 4, blockedItems: 0 },
    errors: [], warnings: []
  };
  return { ...base, planHash: materializationPlanHash(base) };
}

function fixture() {
  const db = getDatabase();
  db.exec(`
    INSERT INTO app_roles (id,code,title) VALUES ('role-r10d','R10D','R10D');
    INSERT INTO users (id,username,password_hash,role_id) VALUES ('actor-r10d','r10d','hash','role-r10d');
    INSERT INTO departments (id,name) VALUES ('dept-1','R10D Department');
    INSERT INTO people (id,full_name) VALUES ('person-1','R10D Owner');
    INSERT INTO import_jobs (id,source_json,status,created_at,analysis_revision) VALUES ('import-r10d','{}','APPROVED','2026-08-26T00:00:00.000Z',1);
  `);
  applyMaterializationFoundationMigration(db);
  const repository = new SQLiteMaterializationRepository(db);
  repository.createOperation({
    operationId: "operation-r10d", importJobId: "import-r10d", approvedAnalysisRevision: 1,
    sourceSnapshotHash: "snapshot-r10d", actorUserId: "actor-r10d", targetPlanYear: 1405,
    requestedAt: "2026-08-26T00:00:00.000Z"
  });
  repository.transition("operation-r10d", "VALIDATING");
  repository.transition("operation-r10d", "READY");
  return { db, repository };
}

function command(): MaterializeCanonicalPlanCommand {
  const value = plan();
  return {
    operationId: "operation-r10d", importJobId: value.importJobId, approvedAnalysisRevision: value.approvedAnalysisRevision,
    sourceSnapshotHash: value.sourceSnapshot.sourceSnapshotHash, planHash: value.planHash,
    actorUserId: "actor-r10d", targetPlanYear: value.planYear, plan: value
  };
}

function canonicalCounts(db: ReturnType<typeof getDatabase>) {
  return ["strategic_goals", "sub_goals", "activities", "work_items", "work_item_collaborators", "materialization_entity_map", "canonical_provenance"]
    .map((table) => Number((db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count));
}

describe("R10-D atomic canonical materialization writer", () => {
  it("materializes the validated hierarchy, mappings, collaborators, provenance, and actual counts", () => {
    const { db } = fixture();
    const result = new SQLiteCanonicalMaterializationWriter(db).execute(command());
    expect(result.status).toBe("COMPLETED");
    expect(result.counts).toEqual({
      goals: 1, objectives: 1, activities: 1, workItems: 1, provenance: 4,
      goalsReused: 0, objectivesReused: 0, activitiesReused: 0, workItemsReused: 0
    });
    expect(db.prepare("SELECT goal_id,sub_goal_id,activity_id,public_id FROM work_items").get()).toMatchObject({
      goal_id: "G01", sub_goal_id: "objective-1405-1", activity_id: "activity-1405-1", public_id: "G01-O01-A01-T001"
    });
    expect(db.prepare("SELECT COUNT(*) AS count FROM work_item_collaborators").get()).toEqual({ count: 1 });
    expect(db.prepare("SELECT status FROM materialization_operations WHERE operation_id=?").get("operation-r10d")).toEqual({ status: "COMPLETED" });
  });

  it("replays a completed snapshot as NOOP without duplicate rows", () => {
    const { db } = fixture();
    const writer = new SQLiteCanonicalMaterializationWriter(db);
    writer.execute(command());
    const before = canonicalCounts(db);
    const replay = writer.execute({ ...command(), operationId: "different-operation-id" });
    expect(replay.status).toBe("NO_OP");
    expect(canonicalCounts(db)).toEqual(before);
  });

  it.each<MaterializationWriterFailurePoint>(["goal", "objective", "activity", "work-item", "provenance", "mapping", "final-operation"])(
    "rolls back all canonical writes at %s failure", (failurePoint) => {
      const { db } = fixture();
      const before = canonicalCounts(db);
      expect(() => new SQLiteCanonicalMaterializationWriter(db, { failurePoint }).execute(command())).toThrow();
      expect(canonicalCounts(db)).toEqual(before);
      expect(db.prepare("SELECT status FROM materialization_operations WHERE operation_id=?").get("operation-r10d")).toEqual({ status: "FAILED" });
    }
  );

  it("permits FAILED retry and creates exactly one canonical result", () => {
    const { db, repository } = fixture();
    expect(() => new SQLiteCanonicalMaterializationWriter(db, { failurePoint: "work-item" }).execute(command())).toThrow();
    repository.transition("operation-r10d", "REQUESTED");
    repository.transition("operation-r10d", "VALIDATING");
    repository.transition("operation-r10d", "READY");
    const result = new SQLiteCanonicalMaterializationWriter(db).execute(command());
    expect(result.status).toBe("COMPLETED");
    expect(canonicalCounts(db)).toEqual([1, 1, 1, 1, 1, 4, 4]);
  });

  it("rejects mismatched plan identity and missing actor before mutation", () => {
    const { db } = fixture();
    expect(() => new SQLiteCanonicalMaterializationWriter(db).execute({ ...command(), planHash: "wrong" })).toThrow(/plan hash/i);
    expect(() => new SQLiteCanonicalMaterializationWriter(db).execute({ ...command(), actorUserId: "" })).toThrow(/actor/i);
    expect(canonicalCounts(db)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("rechecks canonical conflicts inside the transaction", () => {
    const { db } = fixture();
    db.prepare("INSERT INTO strategic_goals(id,title,plan_year) VALUES ('existing','goal-1',1405)").run();
    expect(() => new SQLiteCanonicalMaterializationWriter(db).execute(command())).toThrow(/conflict/i);
    expect(db.prepare("SELECT COUNT(*) AS count FROM sub_goals").get()).toEqual({ count: 0 });
  });
});
