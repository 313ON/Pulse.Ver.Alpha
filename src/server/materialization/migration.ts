import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const MATERIALIZATION_MIGRATION_ID = "0002_materialization_foundation";

export function applyMaterializationFoundationMigration(database: Database.Database): void {
  const migrationPath = path.join(process.cwd(), "db", "migrations", `${MATERIALIZATION_MIGRATION_ID}.sql`);
  database.exec(fs.readFileSync(migrationPath, "utf8"));
  const columns = new Set((database.prepare("PRAGMA table_info(materialization_operations)").all() as Array<{ name: string }>).map((column) => column.name));
  for (const name of ["goal_reused_count", "objective_reused_count", "activity_reused_count", "work_item_reused_count"]) {
    if (!columns.has(name)) database.exec(`ALTER TABLE materialization_operations ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 0 CHECK (${name} >= 0)`);
  }
}
