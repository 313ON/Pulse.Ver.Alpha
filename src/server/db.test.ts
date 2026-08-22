import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDatabase, checkDatabaseReadiness, getDatabase } from "./db";
import { schemaContractErrors } from "./schema-contract";

const environment = process.env as Record<string, string | undefined>;
const originalNodeEnv = environment.NODE_ENV;
const originalDatabasePath = environment.PULSE_DB_PATH;

afterEach(() => {
  closeDatabase();
  if (originalNodeEnv === undefined) delete environment.NODE_ENV;
  else environment.NODE_ENV = originalNodeEnv;
  if (originalDatabasePath === undefined) delete environment.PULSE_DB_PATH;
  else environment.PULSE_DB_PATH = originalDatabasePath;
});

describe("production database configuration", () => {
  it("validates the complete canonical schema contract", () => {
    environment.NODE_ENV = "test";
    environment.PULSE_DB_PATH = path.join(os.tmpdir(), `pulse-contract-${Date.now()}-${Math.random()}.sqlite`);

    expect(schemaContractErrors(getDatabase())).toEqual([]);
  });

  it("detects missing schema objects beyond table names", () => {
    environment.NODE_ENV = "test";
    environment.PULSE_DB_PATH = path.join(os.tmpdir(), `pulse-contract-drift-${Date.now()}-${Math.random()}.sqlite`);
    const database = getDatabase();

    database.exec("DROP INDEX audit_log_entity_idx");
    database.exec("DROP TRIGGER audit_log_immutable_update");
    database.exec("ALTER TABLE users DROP COLUMN updated_at");

    const errors = schemaContractErrors(database);
    expect(errors).toEqual(expect.arrayContaining([
      'missing column "users.updated_at"',
      'missing index "audit_log_entity_idx"',
      'missing trigger "audit_log_immutable_update"'
    ]));
  });

  it("detects foreign-key drift", () => {
    environment.NODE_ENV = "test";
    const databasePath = path.join(os.tmpdir(), `pulse-fk-drift-${Date.now()}-${Math.random()}.sqlite`);
    const schema = fs.readFileSync(path.join(process.cwd(), "db", "schema.sqlite.sql"), "utf8");
    const foreignKey = "FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT";
    const usersSectionStart = schema.indexOf("CREATE TABLE IF NOT EXISTS users");
    const foreignKeyIndex = schema.indexOf(foreignKey, usersSectionStart);
    expect(foreignKeyIndex).toBeGreaterThan(-1);
    const lineStart = schema.lastIndexOf("\n", foreignKeyIndex) + 1;
    const lineEnd = schema.indexOf("\n", foreignKeyIndex);
    const beforeForeignKey = schema.slice(0, lineStart).replace(/,\r?\n$/, "\n");
    const withoutForeignKey = `${beforeForeignKey}${schema.slice(lineEnd + 1)}`;
    const raw = new Database(databasePath);
    raw.exec(withoutForeignKey);
    expect(schemaContractErrors(raw)).toEqual(expect.arrayContaining([
      'missing foreign key "users.department_id -> departments.id"'
    ]));
    raw.close();
    fs.rmSync(databasePath, { force: true });
  });

  it("fails closed when PULSE_DB_PATH is missing in production", () => {
    environment.NODE_ENV = "production";
    delete environment.PULSE_DB_PATH;

    expect(() => getDatabase()).toThrow("PULSE_DB_PATH must be configured in production.");
  });

  it("rejects relative database paths in production", () => {
    environment.NODE_ENV = "production";
    environment.PULSE_DB_PATH = "db/runtime.sqlite";

    expect(() => getDatabase()).toThrow("PULSE_DB_PATH must be an absolute path in production.");
  });

  it("rejects database paths inside the application directory in production", () => {
    environment.NODE_ENV = "production";
    environment.PULSE_DB_PATH = `${process.cwd()}\\db\\runtime.sqlite`;

    expect(() => getDatabase()).toThrow("PULSE_DB_PATH must point outside the application directory in production.");
  });

  it("does not cache a database connection when initialization fails", () => {
    environment.NODE_ENV = "production";
    const databasePath = path.join(os.tmpdir(), `pulse-invalid-${Date.now()}-${Math.random()}.sqlite`);
    fs.writeFileSync(databasePath, "not a sqlite database");
    environment.PULSE_DB_PATH = databasePath;

    try {
      expect(() => getDatabase()).toThrow("The database could not be initialized.");
      closeDatabase();
      expect(() => getDatabase()).toThrow("The database could not be initialized.");
    } finally {
      closeDatabase();
      fs.rmSync(databasePath, { force: true });
    }
  });

  it("rejects an existing database with an incomplete schema as not ready", () => {
    environment.NODE_ENV = "test";
    const databasePath = path.join(os.tmpdir(), `pulse-incomplete-${Date.now()}-${Math.random()}.sqlite`);
    environment.PULSE_DB_PATH = databasePath;
    const db = getDatabase();
    db.exec("DROP TABLE audit_log");

    try {
      expect(() => checkDatabaseReadiness()).toThrow(/The database schema is incomplete/);
    } finally {
      closeDatabase();
      fs.rmSync(databasePath, { force: true });
    }
  });

  it("rejects a database with a non-repairable missing canonical column", () => {
    environment.NODE_ENV = "test";
    const databasePath = path.join(os.tmpdir(), `pulse-column-drift-${Date.now()}-${Math.random()}.sqlite`);
    const schema = fs.readFileSync(path.join(process.cwd(), "db", "schema.sqlite.sql"), "utf8");
    const column = "  username TEXT NOT NULL UNIQUE,\n";
    const withoutColumn = schema.replace(column, "");
    const raw = new Database(databasePath);
    raw.exec(withoutColumn);
    raw.close();
    environment.PULSE_DB_PATH = databasePath;

    try {
      expect(() => checkDatabaseReadiness()).toThrow(/schema is incomplete/);
    } finally {
      closeDatabase();
      fs.rmSync(databasePath, { force: true });
    }
  });
});
