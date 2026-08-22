import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { schemaContractErrors } from "./schema-contract";

let database: Database.Database | undefined;
let readOnlyDatabase: Database.Database | undefined;

export const SQLITE_BUSY_TIMEOUT_MS = 5000;
export const SQLITE_WAL_AUTOCHECKPOINT_PAGES = 1000;

export class DatabaseUnavailableError extends Error {
  constructor(message = "The database is unavailable.") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

const unavailableSqliteCodes = new Set([
  "SQLITE_BUSY",
  "SQLITE_CANTOPEN",
  "SQLITE_CORRUPT",
  "SQLITE_IOERR",
  "SQLITE_LOCKED",
  "SQLITE_NOTADB",
  "SQLITE_READONLY"
]);

export function isDatabaseUnavailableError(error: unknown): boolean {
  if (error instanceof DatabaseUnavailableError) return true;
  const code = error && typeof error === "object" && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;
  return typeof code === "string" && unavailableSqliteCodes.has(code);
}

function databasePath(): string {
  const configuredPath = process.env.PULSE_DB_PATH?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!configuredPath) {
      throw new Error("PULSE_DB_PATH must be configured in production.");
    }
    if (!path.isAbsolute(configuredPath)) {
      throw new Error("PULSE_DB_PATH must be an absolute path in production.");
    }
    const repositoryPath = path.resolve(process.cwd());
    const configuredDatabasePath = path.resolve(configuredPath);
    const relativePath = path.relative(repositoryPath, configuredDatabasePath);
    if (relativePath === "" || (!relativePath.startsWith(".." + path.sep) && relativePath !== ".." && !path.isAbsolute(relativePath))) {
      throw new Error("PULSE_DB_PATH must point outside the application directory in production.");
    }
  }
  return configuredPath || path.join(process.cwd(), "db", "pulse.sqlite");
}

function configureWritableConnection(database: Database.Database, filePath: string): void {
  database.pragma("busy_timeout = " + SQLITE_BUSY_TIMEOUT_MS);
  if (filePath !== ":memory:") {
    const journalMode = String(database.pragma("journal_mode = WAL", { simple: true })).toLowerCase();
    if (journalMode !== "wal") throw new Error(`SQLite WAL mode could not be enabled (actual mode: ${journalMode}).`);
  }
  database.pragma("synchronous = FULL");
  database.pragma("foreign_keys = ON");
  database.pragma("wal_autocheckpoint = " + SQLITE_WAL_AUTOCHECKPOINT_PAGES);
  database.pragma("locking_mode = NORMAL");
  database.pragma("temp_store = DEFAULT");
}

function configureReadOnlyConnection(database: Database.Database): void {
  database.pragma("busy_timeout = " + SQLITE_BUSY_TIMEOUT_MS);
  database.pragma("synchronous = FULL");
  database.pragma("foreign_keys = ON");
  database.pragma("wal_autocheckpoint = " + SQLITE_WAL_AUTOCHECKPOINT_PAGES);
  database.pragma("locking_mode = NORMAL");
  database.pragma("temp_store = DEFAULT");
}

function ensurePhaseFiveSchema(database: Database.Database): void {
  // Canonical schema ownership lives in db/schema.sqlite.sql. This function
  // only repairs columns that may be absent from legacy databases.
  const columns = database.prepare("PRAGMA table_info(work_items)").all() as Array<{ name: string }>;
  const known = new Set(columns.map((column) => column.name));
  const additions: Array<[string, string]> = [
    ["activity_id", "TEXT"],
    ["description", "TEXT"],
    ["role_id", "TEXT"],
    ["target", "TEXT"],
    ["risk_id", "TEXT"],
    ["notes", "TEXT"],
    ["attachments_json", "TEXT"],
    ["external_source_id", "TEXT"],
    ["created_at", "TEXT"],
    ["updated_at", "TEXT"]
  ];
  for (const [name, definition] of additions) {
    if (!known.has(name)) database.exec(`ALTER TABLE work_items ADD COLUMN ${name} ${definition}`);
  }
  const roleColumns = database.prepare("PRAGMA table_info(app_roles)").all() as Array<{ name: string }>;
  if (!roleColumns.some((column) => column.name === "scope")) database.exec("ALTER TABLE app_roles ADD COLUMN scope TEXT NOT NULL DEFAULT 'COMPANY'");
  const userColumns = database.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!userColumns.some((column) => column.name === "department_id")) database.exec("ALTER TABLE users ADD COLUMN department_id TEXT");
}

export function getDatabase(): Database.Database {
  if (!database) {
    const filePath = databasePath();
    let candidate: Database.Database | undefined;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      candidate = new Database(filePath);
      configureWritableConnection(candidate, filePath);
      const schema = fs.readFileSync(path.join(process.cwd(), "db", "schema.sqlite.sql"), "utf8");
      candidate.exec(schema);
      ensurePhaseFiveSchema(candidate);
      database = candidate;
    } catch (error) {
      candidate?.close();
      const detail = error instanceof Error ? ` ${error.message}` : "";
      throw new DatabaseUnavailableError(`The database could not be initialized.${detail}`);
    }
  }
  return database;
}

/**
 * Opens the configured SQLite file without runtime schema initialization.
 * Read-only consumers must use this boundary so reads cannot create or alter
 * the database as a side effect.
 */
export function getReadOnlyDatabase(): Database.Database {
  if (!readOnlyDatabase) {
    readOnlyDatabase = new Database(databasePath(), {
      readonly: true,
      fileMustExist: true
    });
    configureReadOnlyConnection(readOnlyDatabase);
  }
  return readOnlyDatabase;
}

export function checkDatabaseReadiness(): void {
  try {
    // Opening through the normal boundary applies only the documented,
    // idempotent legacy-column repair before the read-only contract check.
    getDatabase();
    const candidate = getReadOnlyDatabase();
    const integrity = candidate.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") throw new DatabaseUnavailableError("The database integrity check failed.");
    const errors = schemaContractErrors(candidate);
    if (errors.length) throw new DatabaseUnavailableError(`The database schema is incomplete: ${errors.join("; ")}`);
  } catch (error) {
    readOnlyDatabase?.close();
    readOnlyDatabase = undefined;
    if (isDatabaseUnavailableError(error)) throw error;
    throw new DatabaseUnavailableError();
  }
}

export function closeDatabase(): void {
  database?.close();
  database = undefined;
  readOnlyDatabase?.close();
  readOnlyDatabase = undefined;
}

export function getDatabaseOperationalConfiguration(database: Database.Database) {
  return {
    journalMode: String(database.pragma("journal_mode", { simple: true })).toLowerCase(),
    synchronous: Number(database.pragma("synchronous", { simple: true })),
    foreignKeys: Number(database.pragma("foreign_keys", { simple: true })),
    busyTimeout: Number(database.pragma("busy_timeout", { simple: true })),
    walAutocheckpoint: Number(database.pragma("wal_autocheckpoint", { simple: true })),
    lockingMode: String(database.pragma("locking_mode", { simple: true })).toLowerCase(),
    tempStore: Number(database.pragma("temp_store", { simple: true }))
  };
}
