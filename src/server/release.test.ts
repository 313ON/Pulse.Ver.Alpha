import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDatabase, getDatabase } from "./db";
import { getReleaseMetadata } from "./release";
import { getSeedMode, seedBaseline } from "./seed";

const root = path.join(os.tmpdir(), `pulse-release-${Date.now()}-${Math.random()}`);
const databasePath = path.join(root, "pulse.sqlite");

afterEach(() => {
  closeDatabase();
  delete process.env.PULSE_DB_PATH;
  delete process.env.PULSE_SEED_MODE;
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  fs.rmSync(root, { recursive: true, force: true });
});

describe("Release 1 identity and seed safety", () => {
  it("records the application and schema identity in SQLite", () => {
    process.env.PULSE_DB_PATH = databasePath;
    const database = getDatabase();
    expect(getReleaseMetadata(database)).toMatchObject({
      releaseName: "PULSE Release 1",
      applicationVersion: "1.0.0",
      schemaVersion: "1"
    });
  });

  it("does not seed demo operational records in production reference mode", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.PULSE_DB_PATH = databasePath;
    process.env.PULSE_SEED_MODE = "reference";
    seedBaseline();
    const database = new Database(databasePath, { readonly: true });
    expect(getSeedMode()).toBe("reference");
    expect(database.prepare("SELECT COUNT(*) AS count FROM departments").get()).toEqual({ count: 6 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM strategic_goals").get()).toEqual({ count: 0 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM work_items").get()).toEqual({ count: 0 });
    database.close();
  });

  it("rejects demo seed mode in production", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.PULSE_SEED_MODE = "demo";
    expect(() => getSeedMode()).toThrow("not permitted in production");
  });
});
