import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let database: Database.Database | undefined;
let readOnlyDatabase: Database.Database | undefined;

function databasePath(): string {
  return process.env.PULSE_DB_PATH ?? path.join(process.cwd(), "db", "pulse.sqlite");
}

function ensurePhaseFiveSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      sub_goal_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      owner_person_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sub_goal_id) REFERENCES sub_goals(id) ON DELETE RESTRICT,
      FOREIGN KEY (owner_person_id) REFERENCES people(id) ON DELETE RESTRICT,
      UNIQUE (sub_goal_id, title)
    );
    CREATE TABLE IF NOT EXISTS app_roles (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'COMPANY' CHECK (scope IN ('COMPANY','DEPARTMENT','OWN')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id TEXT NOT NULL,
      permission_id TEXT NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES app_roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      person_id TEXT,
      role_id TEXT NOT NULL,
      department_id TEXT,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE RESTRICT,
      FOREIGN KEY (role_id) REFERENCES app_roles(id) ON DELETE RESTRICT,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
  `);
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
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    database = new Database(filePath);
    database.pragma("foreign_keys = ON");
    const schema = fs.readFileSync(path.join(process.cwd(), "db", "schema.sqlite.sql"), "utf8");
    database.exec(schema);
    ensurePhaseFiveSchema(database);
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
    readOnlyDatabase.pragma("foreign_keys = ON");
  }
  return readOnlyDatabase;
}

export function closeDatabase(): void {
  database?.close();
  database = undefined;
  readOnlyDatabase?.close();
  readOnlyDatabase = undefined;
}
