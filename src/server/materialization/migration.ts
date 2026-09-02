import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const MATERIALIZATION_MIGRATION_ID = "0002_materialization_foundation";
export const DEPARTMENTAL_GOALS_MIGRATION_ID = "0003_departmental_goals";

export function applyMaterializationFoundationMigration(database: Database.Database): void {
  const migrationPath = path.join(process.cwd(), "db", "migrations", `${MATERIALIZATION_MIGRATION_ID}.sql`);
  database.exec(fs.readFileSync(migrationPath, "utf8"));
  const columns = new Set((database.prepare("PRAGMA table_info(materialization_operations)").all() as Array<{ name: string }>).map((column) => column.name));
  for (const name of ["goal_reused_count", "objective_reused_count", "activity_reused_count", "work_item_reused_count"]) {
    if (!columns.has(name)) database.exec(`ALTER TABLE materialization_operations ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 0 CHECK (${name} >= 0)`);
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
