import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "../../server/db";
import { seedBaseline } from "../../server/seed";
import { seedAuthFoundation } from "../../server/auth";
import { XlsxWorkbookReader } from "../import/spreadsheet/xlsx";
import { SpreadsheetMappingEngine } from "../import/spreadsheet/mapping";
import { ImportReviewService } from "../import/staging";
import { SQLiteImportJobRepository, SQLiteImportRecordRepository } from "../../server/import/SQLiteImportRepositories";
import { DepartmentalMaterializationService } from "./departmental";
import { programFixture } from "../../domain/program";

const inputs = [
  ["Annual program supplies - برنامه سال 1405 - تدارکات -اصلاحی (1).xlsx", "SUPPORTING", "procurement"],
  ["برنامه سال 1405 واحد نت با تفکیک اقدامات.xlsx", "DERIVED", "maintenance"],
  ["برنامه سال 1405 آقای عبودی.xlsx", "DERIVED", "production"],
  ["پیش نویس برنامه سالیانه 1405 واحد اداری (1).xlsx", "DERIVED", "administration"]
] as const;

let databasePath = "";

beforeEach(() => {
  closeDatabase();
  databasePath = path.join(os.tmpdir(), `pulse-departmental-production-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
  process.env.PULSE_DB_PATH = databasePath;
  process.env.PULSE_ADMIN_PASSWORD = "departmental-production-password";
  seedBaseline();
  seedAuthFoundation();
  getDatabase().prepare("INSERT INTO users (id,username,password_hash,role_id) VALUES (?,?,?,?)")
    .run("production-actor", "production-actor", "hash", "role-super-admin");
});

afterEach(async () => {
  closeDatabase();
  for (const file of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    await fs.rm(file, { force: true });
  }
});

async function approvedJob(review: ImportReviewService, index: number, input = inputs[index]) {
  const [name, classification, domain] = input;
  const bytes = await fs.readFile(path.join(process.cwd(), "Samples", name));
  const workbook = await new XlsxWorkbookReader().read(bytes, { name });
  const records = new SpreadsheetMappingEngine({ sourceName: name }).map(workbook);
  const id = `production-${index}-${Date.now()}`;
  review.createJob({ type: "EXCEL", name, metadata: { planYear: 1405, classification, domain } }, id);
  review.attachRecords(id, records);
  review.analyze(id, programFixture);
  review.approve(id);
  return id;
}

describe("production-integrated departmental materialization", () => {
  it("persists all validated departmental workbooks across a close/reopen boundary", async () => {
    const review = new ImportReviewService(undefined, new SQLiteImportJobRepository(), new SQLiteImportRecordRepository());
    const materializer = new DepartmentalMaterializationService();
    let total = 0;
    for (let index = 0; index < inputs.length; index += 1) {
      const id = await approvedJob(review, index);
      const result = materializer.materialize("production-actor", id, 1405);
      expect(result.duplicate).toBe(false);
      total += result.recordCount;
    }
    const before = getDatabase().prepare("SELECT COUNT(*) AS count FROM departmental_planning_records").get() as { count: number };
    expect(before.count).toBe(3053);
    expect(getDatabase().prepare("SELECT COUNT(*) AS count FROM departmental_materialization_operations").get()).toEqual({ count: 4 });
    closeDatabase();
    const reopened = getDatabase();
    expect(reopened.prepare("SELECT COUNT(*) AS count FROM departmental_planning_records").get()).toEqual({ count: total });
    expect(reopened.prepare("SELECT COUNT(*) AS count FROM strategic_goals").get()).toEqual({ count: 10 });
    expect(reopened.prepare("SELECT COUNT(*) AS count FROM sub_goals").get()).toEqual({ count: 0 });
    expect(reopened.prepare("SELECT COUNT(*) AS count FROM activities").get()).toEqual({ count: 0 });
    expect(reopened.prepare("SELECT COUNT(*) AS count FROM work_items").get()).toEqual({ count: 6 });
    expect(reopened.prepare("SELECT COUNT(*) AS count FROM departments").get()).toEqual({ count: 6 });
    expect(reopened.prepare("SELECT COUNT(*) AS count FROM seats").get()).toEqual({ count: 5 });
    expect(reopened.prepare("SELECT COUNT(*) AS count FROM people").get()).toEqual({ count: 5 });
  }, 60_000);

  it("rejects duplicate source jobs, incomplete provenance, unauthorized actors, and unapproved imports", async () => {
    const review = new ImportReviewService(undefined, new SQLiteImportJobRepository(), new SQLiteImportRecordRepository());
    const materializer = new DepartmentalMaterializationService();
    const first = await approvedJob(review, 0);
    expect(materializer.materialize("production-actor", first, 1405).duplicate).toBe(false);
    const duplicate = await approvedJob(review, 4, inputs[0]);
    expect(() => materializer.materialize("production-actor", duplicate, 1405)).toThrow(/already been materialized/i);
    const unapproved = review.createJob({ type: "EXCEL", name: "unapproved.xlsx", metadata: { classification: "DERIVED" } }, "unapproved");
    expect(() => materializer.materialize("production-actor", unapproved.id, 1405)).toThrow(/APPROVED/i);
    expect(() => materializer.materialize("missing-actor", first, 1405)).toThrow(/actor/i);
    const incomplete = await approvedJob(review, 5, inputs[1]);
    const records = new SQLiteImportRecordRepository().getByJobId(incomplete);
    records[0] = { ...records[0], provenance: [] };
    new SQLiteImportRecordRepository().attach(incomplete, records);
    expect(() => materializer.materialize("production-actor", incomplete, 1405)).toThrow(/provenance/i);
  }, 60_000);

  it("rolls back the operation and records when persistence fails", async () => {
    const review = new ImportReviewService(undefined, new SQLiteImportJobRepository(), new SQLiteImportRecordRepository());
    const id = await approvedJob(review, 0);
    const database = getDatabase();
    database.exec("CREATE TRIGGER departmental_acceptance_failure AFTER INSERT ON departmental_planning_records BEGIN SELECT RAISE(ABORT, 'controlled acceptance failure'); END");
    expect(() => new DepartmentalMaterializationService().materialize("production-actor", id, 1405)).toThrow(/controlled acceptance failure/i);
    database.exec("DROP TRIGGER departmental_acceptance_failure");
    expect(database.prepare("SELECT COUNT(*) AS count FROM departmental_materialization_operations").get()).toEqual({ count: 0 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM departmental_planning_records").get()).toEqual({ count: 0 });
  }, 30_000);
});
