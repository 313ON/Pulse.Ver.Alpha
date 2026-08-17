import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let database: Database.Database | undefined;

export function getDatabase(): Database.Database {
  if (!database) {
    const databasePath = process.env.PULSE_DB_PATH ?? path.join(process.cwd(), "db", "pulse.sqlite");
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    database = new Database(databasePath);
    database.pragma("foreign_keys = ON");
    const schema = fs.readFileSync(path.join(process.cwd(), "db", "schema.sqlite.sql"), "utf8");
    database.exec(schema);
  }
  return database;
}

export function closeDatabase(): void {
  database?.close();
  database = undefined;
}
