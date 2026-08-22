import { afterEach, beforeEach, describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { closeDatabase, getDatabase } from "../db";
import type { ImportRecord } from "../../application/import/contracts";
import type { ImportJob } from "../../application/import/staging/ImportJob";
import { SQLiteImportJobRepository, SQLiteImportRecordRepository } from "./SQLiteImportRepositories";

const source = { type: "MANUAL" as const, name: "transaction-test", metadata: {} };
const record = (id: string): ImportRecord => ({
  id,
  entityType: "action",
  source,
  data: { title: id }
});

let databasePath = "";

beforeEach(() => {
  closeDatabase();
  databasePath = path.join(os.tmpdir(), `pulse-import-${Date.now()}-${Math.random()}.sqlite`);
  process.env.PULSE_DB_PATH = databasePath;
});

afterEach(() => {
  closeDatabase();
});

describe("SQLite import persistence", () => {
  it("replaces records atomically on success", () => {
    const jobs = new SQLiteImportJobRepository();
    const records = new SQLiteImportRecordRepository();
    const job: ImportJob = {
      id: "job-atomic",
      source,
      status: "DRAFT",
      records: [],
      createdAt: new Date().toISOString()
    };

    jobs.create(job);
    records.attach(job.id, [record("old")]);
    records.attach(job.id, [record("new-1"), record("new-2")]);

    expect(records.getByJobId(job.id).map((item) => item.id)).toEqual(["new-1", "new-2"]);
  });

  it("rolls back deletion and partial inserts when replacement fails", () => {
    const jobs = new SQLiteImportJobRepository();
    const records = new SQLiteImportRecordRepository();
    const job: ImportJob = {
      id: "job-rollback",
      source,
      status: "DRAFT",
      records: [],
      createdAt: new Date().toISOString()
    };

    jobs.create(job);
    records.attach(job.id, [record("preserved")]);

    expect(() => records.attach(job.id, [record("new"), record("new")])).toThrow();
    expect(records.getByJobId(job.id).map((item) => item.id)).toEqual(["preserved"]);
    expect(getDatabase().prepare("SELECT id FROM import_jobs WHERE id = ?").get(job.id)).toEqual({ id: job.id });
  });
});
