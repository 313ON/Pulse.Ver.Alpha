import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createIdentifierService, type PulseIdentifierType } from "../identifier/IdentifierService";

export const MATERIALIZATION_MIGRATION_ID = "0002_materialization_foundation";
export const DEPARTMENTAL_GOALS_MIGRATION_ID = "0003_departmental_goals";
export const MATERIALIZATION_SNAPSHOT_MIGRATION_ID = "0004_materialization_snapshots";
export const DEPARTMENTAL_MATERIALIZATION_SNAPSHOT_MIGRATION_ID = "0005_departmental_materialization_snapshots";
export const APPROVED_MATERIALIZATION_SNAPSHOT_MIGRATION_ID = "0006_approved_materialization_snapshots";
export const PULSE_IDENTIFIER_ALLOCATION_MIGRATION_ID = "0007_pulse_identifier_allocations";
export const GLOBAL_PULSE_IDENTITY_MIGRATION_ID = "0008_global_pulse_identity";

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
  const identifierMigrationPath = path.join(process.cwd(), "db", "migrations", `${PULSE_IDENTIFIER_ALLOCATION_MIGRATION_ID}.sql`);
  database.exec(fs.readFileSync(identifierMigrationPath, "utf8"));
  repairIdentifierAllocationConstraint(database);
  applyGlobalPulseIdentityMigration(database);
  repairDepartmentalSnapshotForeignKeys(database);
}

function repairIdentifierAllocationConstraint(database: Database.Database): void {
  const row = database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='pulse_identifier_allocations'").get() as { sql?: string } | undefined;
  if (!row?.sql?.includes("'goal', 'action'")) return;
  database.pragma("foreign_keys = OFF");
  try {
    database.transaction(() => {
      database.exec(`
        ALTER TABLE pulse_identifier_allocations RENAME TO pulse_identifier_allocations_legacy;
        CREATE TABLE pulse_identifier_allocations (
          allocation_key TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL CHECK (entity_type IN ('department','position','person','program','goal','departmental_goal','objective','activity','action','kpi','risk','dependency','monthly_review')),
          last_value INTEGER NOT NULL CHECK (last_value >= 0),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO pulse_identifier_allocations SELECT * FROM pulse_identifier_allocations_legacy;
        DROP TABLE pulse_identifier_allocations_legacy;
        CREATE TRIGGER IF NOT EXISTS pulse_identifier_allocations_updated_at
        AFTER UPDATE ON pulse_identifier_allocations
        BEGIN
          UPDATE pulse_identifier_allocations SET updated_at = CURRENT_TIMESTAMP WHERE allocation_key = NEW.allocation_key;
        END;
      `);
    })();
  } finally { database.pragma("foreign_keys = ON"); }
}

function addIdentityColumns(database: Database.Database, table: string, external = true): void {
  const columns = new Set((database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name));
  if (!columns.has("pulse_identifier")) database.exec(`ALTER TABLE ${table} ADD COLUMN pulse_identifier TEXT`);
  if (external && !columns.has("external_source_id")) database.exec(`ALTER TABLE ${table} ADD COLUMN external_source_id TEXT`);
  database.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ${table}_pulse_identifier_uq ON ${table}(pulse_identifier) WHERE pulse_identifier IS NOT NULL`);
}

export function applyGlobalPulseIdentityMigration(database: Database.Database): void {
  const migrationPath = path.join(process.cwd(), "db", "migrations", `${GLOBAL_PULSE_IDENTITY_MIGRATION_ID}.sql`);
  database.exec(fs.readFileSync(migrationPath, "utf8"));
  for (const table of ["strategic_goals", "departmental_goals", "departments", "seats", "people", "sub_goals", "work_items", "activities", "kpis", "risks", "dependencies", "monthly_reviews"]) {
    addIdentityColumns(database, table);
  }
  const identifiers = createIdentifierService(database);
  const run = database.transaction(() => {
    const register = database.prepare("INSERT OR IGNORE INTO pulse_entity_identities (technical_id, entity_type, pulse_identifier, external_source_id) VALUES (?, ?, ?, ?)");
    const assign = (table: string, entityType: PulseIdentifierType, rows: Array<Record<string, unknown>>, pulse: (row: Record<string, unknown>) => string, external: (row: Record<string, unknown>) => string | null = () => null) => {
      const update = database.prepare(`UPDATE ${table} SET pulse_identifier = ? WHERE id = ?`);
      for (const row of rows) {
        const technicalId = String(row.id);
        const value = String(row.pulse_identifier ?? "").trim() || pulse(row);
        register.run(technicalId, entityType, value, external(row));
        update.run(value, technicalId);
      }
    };
    assign("strategic_goals", "goal", database.prepare("SELECT id, pulse_identifier FROM strategic_goals").all() as Array<Record<string, unknown>>, (row) => /^G\d+$/.test(String(row.id)) ? String(row.id) : identifiers.generate("goal"));
    assign("departments", "department", database.prepare("SELECT id, pulse_identifier, external_source_id FROM departments").all() as Array<Record<string, unknown>>, () => identifiers.generate("department"), (row) => row.external_source_id ? String(row.external_source_id) : null);
    assign("seats", "position", database.prepare("SELECT id, pulse_identifier, external_source_id FROM seats").all() as Array<Record<string, unknown>>, () => identifiers.generate("position"), (row) => row.external_source_id ? String(row.external_source_id) : null);
    assign("people", "person", database.prepare("SELECT id, pulse_identifier, external_source_id FROM people").all() as Array<Record<string, unknown>>, () => identifiers.generate("person"), (row) => row.external_source_id ? String(row.external_source_id) : null);
    assign("departmental_goals", "departmental_goal", database.prepare("SELECT id, pulse_identifier, plan_year, external_source_id FROM departmental_goals").all() as Array<Record<string, unknown>>, (row) => identifiers.generate("departmental_goal", { planYear: Number(row.plan_year) }));
    assign("sub_goals", "objective", database.prepare("SELECT id, pulse_identifier, goal_id, external_source_id FROM sub_goals").all() as Array<Record<string, unknown>>, (row) => identifiers.generate("objective", { parentId: String(row.goal_id) }));
    assign("activities", "activity", database.prepare("SELECT id, pulse_identifier, sub_goal_id, external_source_id FROM activities").all() as Array<Record<string, unknown>>, (row) => identifiers.generate("activity", { parentId: String(row.sub_goal_id) }));
    assign("work_items", "action", database.prepare("SELECT id, pulse_identifier, public_id, plan_year, goal_id, external_source_id FROM work_items").all() as Array<Record<string, unknown>>, (row) => String(row.public_id ?? identifiers.generate("action", { planYear: Number(row.plan_year), goalId: String(row.goal_id) })), (row) => row.external_source_id ? String(row.external_source_id) : null);
    assign("kpis", "kpi", database.prepare("SELECT id, pulse_identifier, external_source_id FROM kpis").all() as Array<Record<string, unknown>>, () => identifiers.generate("kpi"));
    assign("risks", "risk", database.prepare("SELECT id, pulse_identifier, external_source_id FROM risks").all() as Array<Record<string, unknown>>, () => identifiers.generate("risk"));
    assign("dependencies", "dependency", database.prepare("SELECT id, pulse_identifier, external_source_id FROM dependencies").all() as Array<Record<string, unknown>>, () => identifiers.generate("dependency"));
    assign("monthly_reviews", "monthly_review", database.prepare("SELECT id, pulse_identifier, external_source_id FROM monthly_reviews").all() as Array<Record<string, unknown>>, () => identifiers.generate("monthly_review"));
  });
  run();
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
