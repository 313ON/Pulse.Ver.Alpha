import fs from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "../../server/db";
import { seedBaseline } from "../../server/seed";
import { seedAuthFoundation } from "../../server/auth";
import { XlsxWorkbookReader } from "../import/spreadsheet/xlsx";
import { SpreadsheetMappingEngine } from "../import/spreadsheet/mapping";
import { ImportReviewService } from "../import/staging";
import { SQLiteImportJobRepository, SQLiteImportRecordRepository } from "../../server/import/SQLiteImportRepositories";
import { DepartmentalMaterializationService } from "./departmental";
import { programFixture } from "../../domain/program";

beforeEach(() => {
  closeDatabase();
  process.env.PULSE_DB_PATH = ":memory:";
  process.env.PULSE_ADMIN_PASSWORD = "departmental-acceptance-password";
  seedBaseline();
  seedAuthFoundation();
  const isolated = getDatabase();
  isolated.exec("PRAGMA foreign_keys=OFF; DELETE FROM work_items; DELETE FROM activities; DELETE FROM sub_goals; DELETE FROM strategic_goals; PRAGMA foreign_keys=ON;");
  isolated.prepare("INSERT INTO users (id,username,password_hash,role_id) VALUES (?,?,?,?)")
    .run("departmental-actor", "departmental-actor", "hash", "role-super-admin");
});

describe("departmental workbook acceptance", () => {
  it("parses, approves, materializes, and deduplicates available departmental workbooks", async () => {
    const inputs = [
      ["Annual program supplies - برنامه سال 1405 - تدارکات -اصلاحی (1).xlsx", "SUPPORTING", "procurement"],
      ["برنامه سال 1405 واحد نت با تفکیک اقدامات.xlsx", "DERIVED", "maintenance"],
      ["برنامه سال 1405 آقای عبودی.xlsx", "DERIVED", "production"],
      ["پیش نویس برنامه سالیانه 1405 واحد اداری (1).xlsx", "DERIVED", "administration"]
    ] as const;
    const review = new ImportReviewService(undefined, new SQLiteImportJobRepository(), new SQLiteImportRecordRepository());
    const materializer = new DepartmentalMaterializationService();
    const reader = new XlsxWorkbookReader();
    const counts = { jobs: 0, records: 0 };
    for (const [name, classification, domain] of inputs) {
      const bytes = await fs.readFile(path.join(process.cwd(), "Samples", name));
      const workbook = await reader.read(bytes, { name });
      const records = new SpreadsheetMappingEngine({ sourceName: name }).map(workbook);
      const jobId = `acceptance-${counts.jobs}`;
      review.createJob({ type: "EXCEL", name, metadata: { planYear: 1405, classification, domain } }, jobId);
      review.attachRecords(jobId, records);
      review.analyze(jobId, programFixture);
      expect(review.approve(jobId).status).toBe("APPROVED");
      const first = materializer.materialize("departmental-actor", jobId, 1405);
      const second = materializer.materialize("departmental-actor", jobId, 1405);
      expect(first.duplicate).toBe(false);
      expect(second.duplicate).toBe(true);
      counts.jobs += 1;
      counts.records += first.recordCount;
    }
    const db = getDatabase();
    expect(db.prepare("SELECT COUNT(*) AS count FROM strategic_goals").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM sub_goals").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM activities").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM work_items").get()).toEqual({ count: 0 });
    expect((db.prepare("SELECT COUNT(*) AS count FROM departmental_planning_records").get() as { count: number }).count).toBe(counts.records);
    expect((db.prepare("SELECT COUNT(*) AS count FROM departmental_materialization_operations").get() as { count: number }).count).toBe(counts.jobs);
    expect((db.prepare("SELECT COUNT(*) AS count FROM departmental_planning_records WHERE length(trim(provenance_json)) > 2").get() as { count: number }).count).toBe(counts.records);
  }, 30_000);
});
