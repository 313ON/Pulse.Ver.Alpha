import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const MATERIALIZATION_MIGRATION_ID = "0002_materialization_foundation";
export const DEPARTMENTAL_GOALS_MIGRATION_ID = "0003_departmental_goals";
export const MATERIALIZATION_SNAPSHOT_MIGRATION_ID = "0004_materialization_snapshots";
export const DEPARTMENTAL_MATERIALIZATION_SNAPSHOT_MIGRATION_ID = "0005_departmental_materialization_snapshots";
export const APPROVED_MATERIALIZATION_SNAPSHOT_MIGRATION_ID = "0006_approved_materialization_snapshots";

export function applyMaterializationFoundationMigration(database: Database.Database): void {
  const migrationPath = path.join(process.cwd(), "db", "migrations", `${MATERIALIZATION_MIGRATION_ID}.sql`);
  database.exec(fs.readFileSync(migrationPath, "utf8"));
  const columns = new Set((database.prepare("PRAGMA table_info(materialization_operations)").all() as Array<{ name: string }>).map((column) => column.name));
  for (const name of ["goal_reused_count", "objective_reused_count", "activity_reused_count", "work_item_reused_count"]) {
    if (!columns.has(name)) database.exec(`ALTER TABLE materialization_operations ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 0 CHECK (${name} >= 0)`);
  }
  const snapshotMigrationPath = path.join(process.cwd(), "db", "migrations", `${MATERIALIZATION_SNAPSHOT_MIGRATION_ID}.sql`);
  database.exec(fs.readFileSync(snapshotMigrationPath, "utf8"));
  const departmentalSnapshotMigrationPath = path.join(process.cwd(), "db", "migrations", `${DEPARTMENTAL_MATERIALIZATION_SNAPSHOT_MIGRATION_ID}.sql`);
  database.exec(fs.readFileSync(departmentalSnapshotMigrationPath, "utf8"));
  const approvedSnapshotMigrationPath = path.join(process.cwd(), "db", "migrations", `${APPROVED_MATERIALIZATION_SNAPSHOT_MIGRATION_ID}.sql`);
  database.exec(fs.readFileSync(approvedSnapshotMigrationPath, "utf8"));
  repairDepartmentalSnapshotForeignKeys(database);
}

function repairDepartmentalSnapshotForeignKeys(database: Database.Database): void {
  const foreignKeys = database.prepare("PRAGMA foreign_key_list(departmental_materialization_snapshots)").all() as Array<{ table: string }>;
  if (foreignKeys.some((foreignKey) => foreignKey.table === "departmental_materialization_operations")) return;

  database.pragma("foreign_keys = OFF");
  try {
    database.exec(`
      ALTER TABLE departmental_materialization_snapshots RENAME TO departmental_materialization_snapshots_legacy;
      CREATE TABLE departmental_materialization_snapshots (
        operation_id TEXT PRIMARY KEY,
        snapshot_version INTEGER NOT NULL CHECK (snapshot_version = 1),
        import_job_id TEXT NOT NULL,
        approved_analysis_revision INTEGER NOT NULL CHECK (approved_analysis_revision > 0),
        source_snapshot_hash TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (import_job_id, approved_analysis_revision, source_snapshot_hash),
        FOREIGN KEY (operation_id) REFERENCES departmental_materialization_operations(operation_id) ON DELETE RESTRICT,
        FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE RESTRICT
      );
      INSERT INTO departmental_materialization_snapshots
        (operation_id, snapshot_version, import_job_id, approved_analysis_revision,
         source_snapshot_hash, payload_hash, payload_json, created_at)
      SELECT operation_id, snapshot_version, import_job_id, approved_analysis_revision,
        source_snapshot_hash, payload_hash, payload_json, created_at
      FROM departmental_materialization_snapshots_legacy;
      DROP TABLE departmental_materialization_snapshots_legacy;
      CREATE TRIGGER IF NOT EXISTS departmental_materialization_snapshots_immutable_update
      BEFORE UPDATE ON departmental_materialization_snapshots
      BEGIN
        SELECT RAISE(ABORT, 'departmental_materialization_snapshots is append-only');
      END;
      CREATE TRIGGER IF NOT EXISTS departmental_materialization_snapshots_immutable_delete
      BEFORE DELETE ON departmental_materialization_snapshots
      BEGIN
        SELECT RAISE(ABORT, 'departmental_materialization_snapshots is append-only');
      END;
    `);
  } finally {
    database.pragma("foreign_keys = ON");
  }
}

export function applyDepartmentalGoalsMigration(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS departmental_goals (
      id TEXT PRIMARY KEY,
      strategic_goal_id TEXT NOT NULL,
      department_id TEXT,
      title TEXT NOT NULL,
      owner_person_id TEXT,
      plan_year INTEGER NOT NULL,
      UNIQUE (strategic_goal_id, department_id, title, plan_year),
      FOREIGN KEY (strategic_goal_id) REFERENCES strategic_goals(id) ON DELETE RESTRICT,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
      FOREIGN KEY (owner_person_id) REFERENCES people(id) ON DELETE RESTRICT
    );
  `);
  const columns = new Set((database.prepare("PRAGMA table_info(sub_goals)").all() as Array<{ name: string }>).map((column) => column.name));
  if (!columns.has("departmental_goal_id")) {
    database.exec("ALTER TABLE sub_goals ADD COLUMN departmental_goal_id TEXT REFERENCES departmental_goals(id) ON DELETE RESTRICT");
  }
  database.exec(`
    CREATE INDEX IF NOT EXISTS departmental_goals_strategic_idx ON departmental_goals(strategic_goal_id);
    CREATE INDEX IF NOT EXISTS sub_goals_departmental_idx ON sub_goals(departmental_goal_id);
  `);
}
