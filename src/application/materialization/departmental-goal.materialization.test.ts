import { afterEach, beforeEach, describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { closeDatabase, getDatabase } from "../../server/db";
import { applyMaterializationFoundationMigration, applyDepartmentalGoalsMigration } from "../../server/materialization/migration";
import { buildMaterializationPlan, materializationPlanHash } from "./plan";
import { createImportSnapshotReference } from "./snapshot";
import { SQLiteCanonicalMaterializationWriter } from "./writer";
import type { ImportJob } from "../import/staging/ImportJob";
import type { ImportRecord } from "../import/contracts";

let databasePath = "";

const point = (recordId: string, row: number) => [{
  workbookName: "program-1405.xlsx", sheetName: "Sheet1", sheetIndex: 0,
  headerRowIndex: 1, rowIndex: row, sourceRowNumber: row, column: "A",
  address: `A${row}`, rawValue: recordId
}];

function record(id: string, entityType: ImportRecord["entityType"], data: Record<string, unknown>, row: number): ImportRecord {
  return {
    id, entityType, data, rowNumber: row,
    source: { type: "EXCEL", name: "program-1405.xlsx", metadata: { sheetIndex: 0, planYear: 1405 } },
    provenance: point(id, row)
  };
}

function approved(records: ImportRecord[]): ImportJob {
  return {
    id: "departmental-goal-import",
    status: "APPROVED",
    source: { type: "EXCEL", name: "program-1405.xlsx", metadata: { planYear: 1405 } },
    records,
    createdAt: "2026-09-02T00:00:00.000Z",
    approvedAt: "2026-09-02T00:01:00.000Z",
    analysisRevision: 1
  } as ImportJob;
}

beforeEach(() => {
  closeDatabase();
  databasePath = path.join(os.tmpdir(), `pulse-departmental-goal-${Date.now()}-${Math.random()}.sqlite`);
  process.env.PULSE_DB_PATH = databasePath;
});

afterEach(() => closeDatabase());

describe("canonical departmental-goal materialization", () => {
  it("preserves ten strategic goals and materializes a mapped departmental hierarchy once", () => {
    const db = getDatabase();
    applyMaterializationFoundationMigration(db);
    applyDepartmentalGoalsMigration(db);
    for (let index = 2; index <= 10; index += 1) {
      db.prepare("INSERT INTO strategic_goals (id,title,plan_year) VALUES (?,?,?)").run(`G${String(index).padStart(2, "0")}`, `Strategic ${index}`, 1405);
    }
    db.prepare("INSERT INTO departments (id,name) VALUES ('maintenance','Maintenance')").run();
    const records = [
      record("sg-1", "goal", { goal: "Strategic 1" }, 2),
      record("dg-1", "departmental_goal", { strategicGoal: "Strategic 1", goal: "Strategic 1", departmentalGoal: "Reduce energy waste" }, 3),
      record("dg-1-repeat", "departmental_goal", { strategicGoal: "Strategic 1", goal: "Strategic 1", departmentalGoal: "Reduce energy waste" }, 4),
      record("obj-1", "objective", { goal: "Strategic 1", departmentalGoal: "Reduce energy waste", objective: "Complete metering" }, 5),
      record("act-1", "activity", { goal: "Strategic 1", departmentalGoal: "Reduce energy waste", objective: "Complete metering", activity: "Inspect meters" }, 6),
      record("action-1", "action", {
        goal: "Strategic 1", departmentalGoal: "Reduce energy waste", objective: "Complete metering",
        activity: "Inspect meters", action: "Inspect line", deliverable: "Report", startDate: "1405/01/01",
        endDate: "1405/01/02", workType: "اقدام", status: "شروع نشده", department: "maintenance", owner: "person"
      }, 7)
    ];
    const job = approved(records);
    const snapshot = createImportSnapshotReference(job, 1405);
    const plan = buildMaterializationPlan({
      importJob: job, snapshot,
      request: snapshot,
      planYear: 1405,
      responsibility: {
        resolvePerson: () => ({ field: "owner", resolved: true, targetType: "PERSON", targetId: "person" }),
        resolveUnit: () => ({ field: "department", resolved: true, targetType: "UNIT", targetId: "maintenance" })
      }
    });
    expect(plan.status).toBe("READY");
    expect(plan.items.filter((item) => item.entityType === "departmental_goal")).toHaveLength(1);
    db.prepare("INSERT INTO app_roles (id,code,title) VALUES ('role','SUPER_ADMIN','Admin')").run();
    db.prepare("INSERT INTO users (id,username,password_hash,role_id) VALUES ('actor','actor','hash','role')").run();
    db.prepare("INSERT INTO people (id,full_name) VALUES ('person','Owner')").run();
    db.prepare("INSERT INTO import_jobs (id,source_json,status,created_at,analysis_revision) VALUES (?,?,?,?,?)").run(job.id, "{}", "APPROVED", job.createdAt, 1);
    db.prepare("INSERT INTO materialization_operations (operation_id,import_job_id,approved_analysis_revision,source_snapshot_hash,actor_user_id,target_plan_year,status,requested_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
      .run("op", job.id, 1, snapshot.sourceSnapshotHash, "actor", 1405, "READY");
    const planWithoutHash = { ...plan };
    delete (planWithoutHash as { planHash?: string }).planHash;
    const withoutHash = {
      ...planWithoutHash,
      items: plan.items.map((item) => item.entityType === "action"
        ? { ...item, canonicalAllocation: { ...item.canonicalAllocation, publicIdInput: "G01-O01-A01-T001" } }
        : item)
    };
    const base = { ...withoutHash, planHash: materializationPlanHash(withoutHash) };
    const result = new SQLiteCanonicalMaterializationWriter(db).execute({
      operationId: "op", importJobId: job.id, approvedAnalysisRevision: 1,
      sourceSnapshotHash: snapshot.sourceSnapshotHash, planHash: base.planHash,
      actorUserId: "actor", targetPlanYear: 1405, plan: base
    });
    expect(result.status).toBe("COMPLETED");
    expect(db.prepare("SELECT COUNT(*) AS count FROM strategic_goals").get()).toEqual({ count: 10 });
    expect(db.prepare("SELECT strategic_goal_id,title FROM departmental_goals").get()).toEqual({ strategic_goal_id: "G01", title: "reduce energy waste" });
    expect(db.prepare("SELECT departmental_goal_id FROM sub_goals").get()).toMatchObject({ departmental_goal_id: expect.stringContaining("DG-1405") });
    expect(db.prepare("SELECT COUNT(*) AS count FROM materialization_entity_map WHERE canonical_entity_type='departmental_goal'").get()).toEqual({ count: 2 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM canonical_provenance WHERE canonical_entity_type='departmental_goal'").get()).toEqual({ count: 2 });
  });

  it("blocks an ambiguous departmental value without inventing a strategic mapping", () => {
    const job = approved([record("ambiguous", "departmental_goal", { departmentalGoal: "کاهش پرت حامل های انرژی و تکمیل" }, 2139)]);
    const snapshot = createImportSnapshotReference(job, 1405);
    const plan = buildMaterializationPlan({ importJob: job, snapshot, request: snapshot, planYear: 1405 });
    expect(plan.status).toBe("BLOCKED");
    expect(plan.errors.some((item) => item.field === "strategicGoal")).toBe(true);
    expect(plan.items.some((item) => item.entityType === "goal" && item.logicalIdentity.title.includes("کاهش"))).toBe(false);
  });
});
