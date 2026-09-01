import Database from "better-sqlite3";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "./db";
import { schemaContractErrors } from "./schema-contract";
import { seedBaseline } from "./seed";
import { seedAuthFoundation, hashPasswordForStorage } from "./auth";
import { ImportReviewService } from "../application/import/staging";
import { SQLiteImportJobRepository, SQLiteImportRecordRepository } from "./import/SQLiteImportRepositories";
import { XlsxWorkbookReader } from "../application/import/spreadsheet/xlsx";
import { SpreadsheetMappingEngine } from "../application/import/spreadsheet/mapping";
import { DepartmentalMaterializationService } from "../application/materialization/departmental";
import { programFixture } from "../domain/program";

const legacySourceName = "Annual program supplies - برنامه سال 1405 - تدارکات -اصلاحی (1).xlsx";
let databasePath = "";

beforeEach(() => {
  closeDatabase();
  databasePath = path.join(os.tmpdir(), `pulse-legacy-fingerprint-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
  process.env.PULSE_DB_PATH = databasePath;
  process.env.PULSE_ADMIN_PASSWORD = "legacy-fingerprint-acceptance-password";
  createLegacyDatabase(databasePath);
});

afterEach(async () => {
  closeDatabase();
  for (const file of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    await fsPromises.rm(file, { force: true });
  }
});

function createLegacyDatabase(filePath: string) {
  const database = new Database(filePath);
  database.exec(fs.readFileSync(path.join(process.cwd(), "db", "schema.sqlite.sql"), "utf8"));
  database.pragma("foreign_keys = OFF");
  database.exec("DROP INDEX departmental_materialization_source_fingerprint_idx");
  database.exec("DROP TABLE departmental_planning_records");
  database.exec(`
    ALTER TABLE departmental_materialization_operations RENAME TO departmental_materialization_operations_current;
    CREATE TABLE departmental_materialization_operations (
      operation_id TEXT PRIMARY KEY,
      import_job_id TEXT NOT NULL,
      approved_analysis_revision INTEGER NOT NULL,
      source_snapshot_hash TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      target_plan_year INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('COMPLETED','FAILED')),
      record_count INTEGER NOT NULL DEFAULT 0,
      provenance_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE (import_job_id, approved_analysis_revision, source_snapshot_hash),
      FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE RESTRICT,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
    );
    INSERT INTO departmental_materialization_operations
      (operation_id, import_job_id, approved_analysis_revision, source_snapshot_hash, actor_user_id,
       target_plan_year, status, record_count, provenance_count, created_at)
    SELECT operation_id, import_job_id, approved_analysis_revision, source_snapshot_hash, actor_user_id,
      target_plan_year, status, record_count, provenance_count, created_at
    FROM departmental_materialization_operations_current;
    DROP TABLE departmental_materialization_operations_current;
  `);
  database.pragma("foreign_keys = ON");
  database.exec(`
    INSERT INTO departments (id, name) VALUES ('legacy-department', 'Legacy department');
    INSERT INTO import_jobs (id, source_json, status, created_at, analysis_revision)
      VALUES ('legacy-import', '{"name":"legacy.xlsx"}', 'APPROVED', '2026-08-20T00:00:00.000Z', 1);
    INSERT INTO app_roles (id, code, title) VALUES ('legacy-role', 'LEGACY', 'Legacy role');
    INSERT INTO users (id, username, password_hash, role_id)
      VALUES ('legacy-actor', 'legacy-actor', 'legacy-hash', 'legacy-role');
    INSERT INTO departmental_materialization_operations
      (operation_id, import_job_id, approved_analysis_revision, source_snapshot_hash, actor_user_id,
       target_plan_year, status, record_count, provenance_count, created_at)
      VALUES ('legacy-operation', 'legacy-import', 1, 'legacy-fingerprint', 'legacy-actor',
        1405, 'COMPLETED', 1, 1, '2026-08-20T00:01:00.000Z');
    CREATE TABLE departmental_planning_records (
      id TEXT PRIMARY KEY,
      operation_id TEXT NOT NULL,
      import_job_id TEXT NOT NULL,
      source_record_id TEXT NOT NULL,
      classification TEXT NOT NULL CHECK (classification IN ('DERIVED','SUPPORTING','REFERENCE','AMBIGUOUS','UNRESOLVED')),
      domain TEXT,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('goal','objective','activity','action')),
      normalized_data_json TEXT NOT NULL,
      raw_record_json TEXT NOT NULL,
      source_workbook TEXT NOT NULL,
      source_sheet TEXT,
      source_row INTEGER,
      source_cell TEXT,
      provenance_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (import_job_id, source_record_id),
      FOREIGN KEY (operation_id) REFERENCES departmental_materialization_operations(operation_id) ON DELETE CASCADE,
      FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE RESTRICT
    );
  `);
  database.close();
}

function catalog(database: Database.Database) {
  return {
    columns: database.prepare("PRAGMA table_info(departmental_materialization_operations)").all() as Array<Record<string, unknown>>,
    indexes: database.prepare("PRAGMA index_list(departmental_materialization_operations)").all() as Array<Record<string, unknown>>,
    foreignKeys: database.prepare("PRAGMA foreign_key_list(departmental_materialization_operations)").all() as Array<Record<string, unknown>>,
    tableSql: (database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'departmental_materialization_operations'").get() as { sql: string }).sql
  };
}

function counts(database: Database.Database) {
  return {
    departments: (database.prepare("SELECT COUNT(*) AS count FROM departments").get() as { count: number }).count,
    importJobs: (database.prepare("SELECT COUNT(*) AS count FROM import_jobs").get() as { count: number }).count,
    users: (database.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count,
    operations: (database.prepare("SELECT COUNT(*) AS count FROM departmental_materialization_operations").get() as { count: number }).count
  };
}

describe("legacy source_fingerprint repair acceptance", () => {
  it("repairs the legacy catalog, preserves data, is idempotent, and remains materialization-compatible", async () => {
    const before = new Database(databasePath);
    const beforeCounts = counts(before);
    const beforeRepresentative = before.prepare("SELECT operation_id, import_job_id, source_snapshot_hash FROM departmental_materialization_operations").get() as {
      operation_id: string;
      import_job_id: string;
      source_snapshot_hash: string;
    };
    const beforeTables = (before.prepare("SELECT name, type, sql FROM sqlite_master WHERE type IN ('table', 'index', 'trigger') ORDER BY type, name").all() as Array<{ name: string; type: string; sql: string | null }>)
      .filter((object) => !["departmental_materialization_operations", "departmental_planning_records"].includes(object.name));
    expect(before.prepare("PRAGMA table_info(departmental_materialization_operations)").all()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "source_fingerprint" })])
    );
    before.close();

    const repaired = getDatabase();
    const repairedCatalog = catalog(repaired);
    const fingerprintColumn = repairedCatalog.columns.find((column) => column.name === "source_fingerprint");
    expect(fingerprintColumn).toMatchObject({ type: "TEXT", notnull: 1 });
    expect(repairedCatalog.indexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "departmental_materialization_source_fingerprint_idx", unique: 1 })
    ]));
    expect(repairedCatalog.tableSql.toLowerCase()).toContain("source_fingerprint text not null");
    expect(repairedCatalog.foreignKeys).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: "import_job_id", table: "import_jobs", to: "id", on_delete: "RESTRICT" }),
      expect.objectContaining({ from: "actor_user_id", table: "users", to: "id", on_delete: "RESTRICT" })
    ]));
    expect(schemaContractErrors(repaired)).toEqual([]);
    expect(repaired.prepare("SELECT source_fingerprint FROM departmental_materialization_operations WHERE operation_id = 'legacy-operation'").get())
      .toEqual({ source_fingerprint: "legacy-fingerprint" });
    expect(counts(repaired)).toEqual(beforeCounts);
    expect(repaired.prepare("SELECT operation_id, import_job_id, source_snapshot_hash FROM departmental_materialization_operations").get())
      .toEqual(beforeRepresentative);
    expect(repaired.prepare("SELECT name, type, sql FROM sqlite_master WHERE type IN ('table', 'index', 'trigger') ORDER BY type, name").all())
      .toEqual(expect.arrayContaining(beforeTables));

    closeDatabase();
    const second = getDatabase();
    const secondCatalog = catalog(second);
    expect(secondCatalog.columns.filter((column) => column.name === "source_fingerprint")).toHaveLength(1);
    expect(secondCatalog.indexes.filter((index) => index.name === "departmental_materialization_source_fingerprint_idx")).toHaveLength(1);
    expect(schemaContractErrors(second)).toEqual([]);
    expect(counts(second)).toEqual(beforeCounts);
    expect(second.prepare("SELECT operation_id, import_job_id, source_snapshot_hash, source_fingerprint FROM departmental_materialization_operations").get())
      .toEqual({ ...beforeRepresentative, source_fingerprint: "legacy-fingerprint" });

    expect(() => second.prepare(`
      INSERT INTO departmental_materialization_operations
      (operation_id, import_job_id, approved_analysis_revision, source_snapshot_hash, source_fingerprint,
       actor_user_id, target_plan_year, status, record_count, provenance_count, created_at)
      VALUES ('duplicate-fingerprint', 'legacy-import', 2, 'different-snapshot', 'legacy-fingerprint',
        'legacy-actor', 1405, 'COMPLETED', 0, 0, '2026-08-20T00:02:00.000Z')
    `).run()).toThrow(/UNIQUE/i);
    expect(() => second.prepare(`
      INSERT INTO departmental_materialization_operations
      (operation_id, import_job_id, approved_analysis_revision, source_snapshot_hash, source_fingerprint,
       actor_user_id, target_plan_year, status, record_count, provenance_count, created_at)
      VALUES ('different-fingerprint', 'legacy-import', 2, 'different-snapshot', 'different-fingerprint',
        'legacy-actor', 1405, 'COMPLETED', 0, 0, '2026-08-20T00:03:00.000Z')
    `).run()).not.toThrow();
    expect(second.prepare("SELECT COUNT(*) AS count FROM departmental_materialization_operations").get()).toEqual({ count: 2 });
    expect(() => second.prepare(`
      INSERT INTO departmental_materialization_operations
      (operation_id, import_job_id, approved_analysis_revision, source_snapshot_hash, source_fingerprint,
       actor_user_id, target_plan_year, status, record_count, provenance_count, created_at)
      VALUES ('null-fingerprint', 'legacy-import', 3, 'null-snapshot', NULL,
        'legacy-actor', 1405, 'COMPLETED', 0, 0, '2026-08-20T00:04:00.000Z')
    `).run()).toThrow(/NOT NULL/i);

    seedBaseline();
    seedAuthFoundation();
    second.prepare("INSERT INTO users (id, username, password_hash, role_id) VALUES (?, ?, ?, ?)")
      .run("materialization-actor", "materialization-actor", hashPasswordForStorage("materialization-password"), "role-super-admin");
    const bytes = await fsPromises.readFile(path.join(process.cwd(), "Samples", legacySourceName));
    const workbook = await new XlsxWorkbookReader().read(bytes, { name: legacySourceName });
    const records = new SpreadsheetMappingEngine({ sourceName: legacySourceName }).map(workbook);
    const review = new ImportReviewService(undefined, new SQLiteImportJobRepository(), new SQLiteImportRecordRepository());
    review.createJob({
      type: "EXCEL",
      name: legacySourceName,
      metadata: { planYear: 1405, classification: "SUPPORTING", domain: "procurement" }
    }, "repaired-materialization-import");
    review.attachRecords("repaired-materialization-import", records);
    review.analyze("repaired-materialization-import", programFixture);
    review.approve("repaired-materialization-import");
    const result = new DepartmentalMaterializationService().materialize("materialization-actor", "repaired-materialization-import", 1405);
    expect(result).toMatchObject({ duplicate: false, recordCount: 500, sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(new DepartmentalMaterializationService().materialize("materialization-actor", "repaired-materialization-import", 1405))
      .toMatchObject({ duplicate: true, operationId: result.operationId });
    expect(second.prepare("SELECT source_fingerprint FROM departmental_materialization_operations WHERE operation_id = ?").get(result.operationId))
      .toEqual({ source_fingerprint: result.sourceFingerprint });
    expect(second.prepare("SELECT COUNT(*) AS count FROM departmental_planning_records WHERE length(trim(provenance_json)) > 2").get()).toEqual({ count: 500 });
    expect(second.prepare("SELECT COUNT(*) AS count FROM strategic_goals").get()).toEqual({ count: 10 });
    expect(second.prepare("SELECT COUNT(*) AS count FROM sub_goals").get()).toEqual({ count: 0 });
    expect(second.prepare("SELECT COUNT(*) AS count FROM activities").get()).toEqual({ count: 0 });
    expect(second.prepare("SELECT COUNT(*) AS count FROM work_items").get()).toEqual({ count: 6 });
  }, 60_000);

  it("fails safely and leaves the legacy schema untouched when backfill cannot be unique", () => {
    const legacy = new Database(databasePath);
    legacy.prepare(`
      INSERT INTO departmental_materialization_operations
      (operation_id, import_job_id, approved_analysis_revision, source_snapshot_hash, actor_user_id,
       target_plan_year, status, record_count, provenance_count, created_at)
      VALUES ('legacy-duplicate-operation', 'legacy-import', 2, 'legacy-fingerprint', 'legacy-actor',
        1405, 'COMPLETED', 1, 1, '2026-08-20T00:02:00.000Z')
    `).run();
    legacy.close();

    expect(() => getDatabase()).toThrow(/The database could not be initialized/);

    const afterFailure = new Database(databasePath);
    expect(afterFailure.prepare("PRAGMA table_info(departmental_materialization_operations)").all()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "source_fingerprint" })])
    );
    expect(afterFailure.prepare("SELECT COUNT(*) AS count FROM departmental_materialization_operations").get()).toEqual({ count: 2 });
    expect(afterFailure.prepare("SELECT source_snapshot_hash FROM departmental_materialization_operations ORDER BY operation_id").all())
      .toEqual([{ source_snapshot_hash: "legacy-fingerprint" }, { source_snapshot_hash: "legacy-fingerprint" }]);
    afterFailure.close();
  });
});
