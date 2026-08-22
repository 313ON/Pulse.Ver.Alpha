import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { backupDatabase, verifyDatabaseBackup } from "./backup";
import { closeDatabase, checkDatabaseReadiness, getDatabase } from "./db";
import { seedBaseline } from "./seed";
import { seedAuthFoundation, verifyPassword } from "./auth";
import { buildReport } from "./reporting";
import { SQLiteImportJobRepository, SQLiteImportRecordRepository } from "./import/SQLiteImportRepositories";

const root = path.join(os.tmpdir(), `pulse-backup-${Date.now()}-${Math.random()}`);
const sourcePath = path.join(root, "source.sqlite");
const backupPath = path.join(root, "backup.sqlite");
const restoredPath = path.join(root, "restored.sqlite");

afterEach(() => {
  closeDatabase();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("SQLite online backup and restore", () => {
  it("creates a verified independent backup that restores application data", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    process.env.PULSE_DB_PATH = sourcePath;
    process.env.PULSE_ADMIN_PASSWORD = "backup-test-password-123";
    seedBaseline();
    seedAuthFoundation();
    const database = getDatabase();
    database.prepare("UPDATE strategic_goals SET title = ? WHERE id = ?").run("Backup source goal", "G01");
    new SQLiteImportJobRepository().create({
      id: "backup-job",
      source: { type: "MANUAL", name: "backup-test", metadata: {} },
      status: "DRAFT",
      records: [],
      createdAt: new Date().toISOString()
    });
    new SQLiteImportRecordRepository().attach("backup-job", [{
      id: "backup-record",
      entityType: "action",
      source: { type: "MANUAL", name: "backup-test", metadata: {} },
      data: { title: "backup" }
    }]);

    await backupDatabase(sourcePath, backupPath);
    verifyDatabaseBackup(backupPath);
    await backupDatabase(backupPath, restoredPath);
    verifyDatabaseBackup(restoredPath);

    const restored = new Database(restoredPath, { readonly: true });
    expect(restored.prepare("SELECT title FROM strategic_goals WHERE id = 'G01'").get()).toEqual({ title: "Backup source goal" });
    expect(restored.prepare("SELECT COUNT(*) AS count FROM import_records WHERE job_id = 'backup-job'").get()).toEqual({ count: 1 });
    const admin = restored.prepare("SELECT password_hash FROM users WHERE username = 'admin'").get() as { password_hash: string };
    expect(verifyPassword("backup-test-password-123", admin.password_hash)).toBe(true);
    restored.close();

    process.env.PULSE_DB_PATH = restoredPath;
    closeDatabase();
    checkDatabaseReadiness();
    expect(buildReport({}).summary.totalActions).toBeGreaterThan(0);
  });
});
