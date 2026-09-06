import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { XlsxWorkbookReader } from "../import/spreadsheet/xlsx";
import { SpreadsheetMappingEngine } from "../import/spreadsheet/mapping";
import { ImportReviewService } from "../import/staging";
import { programFixture } from "../../domain/program";
import { beforeEach } from "vitest";
import { closeDatabase, getDatabase } from "../../server/db";
import { seedBaseline } from "../../server/seed";
import { seedAuthFoundation } from "../../server/auth";
import { SQLiteImportJobRepository, SQLiteImportRecordRepository } from "../../server/import/SQLiteImportRepositories";
import { createImportSnapshotReference } from "./snapshot";
import { buildMaterializationPlan } from "./plan";
import { MaterializationApplicationService } from "./service";

beforeEach(() => {
  closeDatabase();
  process.env.PULSE_DB_PATH = ":memory:";
  process.env.PULSE_SEED_MODE = "reference";
  process.env.PULSE_ADMIN_PASSWORD = "master-plan-run-password";
  seedBaseline();
  seedAuthFoundation();
  getDatabase().prepare("INSERT INTO users (id,username,password_hash,role_id) VALUES (?,?,?,?)").run("master-plan-actor", "master-plan-actor", "hash", "role-super-admin");
});

describe("real Master Plan operational probe", () => {
  it("reports the supported pipeline state", async () => {
    const name = "برنامه عملیاتی سال ۱۴۰۵ - Master Plan (Unit-Based)-V1.1.xlsx";
    const workbook = await new XlsxWorkbookReader().read(await fs.readFile(path.join(process.cwd(), "Samples", name)), { name });
    const records = new SpreadsheetMappingEngine({ sourceName: name }).map(workbook);
    const review = new ImportReviewService(undefined, new SQLiteImportJobRepository(), new SQLiteImportRecordRepository());
    const job = review.createJob({ type: "EXCEL", name, metadata: { planYear: 1405, classification: "CANONICAL", domain: "master-plan" } }, "master-plan-probe");
    review.attachRecords(job.id, records);
    review.analyze(job.id, programFixture);
    review.approvalReadiness(job.id);
    const approved = review.approve(job.id);
    const snapshot = createImportSnapshotReference(approved, 1405);
    const departmentIds = new Map((getDatabase().prepare("SELECT id,name FROM departments").all() as Array<{ id: string; name: string }>).map((row) => [row.name, row.id]));
    const plan = buildMaterializationPlan({
      importJob: approved,
      snapshot,
      request: snapshot,
      planYear: 1405,
      responsibility: {
        resolvePerson: (value) => ({ field: "owner", resolved: false, reason: `No person authority for ${String(value)}` }),
        resolveUnit: (value) => {
          const name = String(value ?? "").trim();
          const id = departmentIds.get(name);
          return { field: "department", resolved: Boolean(id), targetType: "UNIT" as const, targetId: id, displayName: name, reason: id ? undefined : `Unknown department ${name}` };
        }
      }
    });
    if (plan.status !== "READY") throw new Error(JSON.stringify(plan.errors.slice(0, 10)));
    const service = new MaterializationApplicationService();
    const first = service.request("master-plan-actor", {
      importJobId: approved.id,
      approvedAnalysisRevision: snapshot.approvedAnalysisRevision,
      sourceSnapshotHash: snapshot.sourceSnapshotHash,
      targetPlanYear: 1405,
      plan
    }, approved.id);
    const second = service.request("master-plan-actor", {
      importJobId: approved.id,
      approvedAnalysisRevision: snapshot.approvedAnalysisRevision,
      sourceSnapshotHash: snapshot.sourceSnapshotHash,
      targetPlanYear: 1405,
      plan
    }, approved.id);
    expect(approved.status).toBe("APPROVED");
    expect(first.operation.status).toBe("COMPLETED");
    expect(second.duplicate).toBe(true);
    const db = getDatabase();
    expect((db.prepare("SELECT COUNT(*) AS count FROM strategic_goals").get() as { count: number }).count).toBe(10);
    expect((db.prepare("SELECT COUNT(*) AS count FROM sub_goals").get() as { count: number }).count).toBe(156);
    expect((db.prepare("SELECT COUNT(*) AS count FROM activities").get() as { count: number }).count).toBe(490);
    expect((db.prepare("SELECT COUNT(*) AS count FROM work_items").get() as { count: number }).count).toBe(1649);
    expect((db.prepare("SELECT COUNT(*) AS count FROM work_item_assignments").get() as { count: number }).count).toBeGreaterThan(0);
  }, 30_000);
});
