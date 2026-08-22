import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { schemaContractErrors } from "./schema-contract";

export async function backupDatabase(sourcePath: string, destinationPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(destinationPath);
  } finally {
    source.close();
  }
}

export function verifyDatabaseBackup(databasePath: string): void {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const integrity = database.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") throw new Error("The database backup integrity check failed.");
    const foreignKeys = database.pragma("foreign_key_check") as unknown[];
    if (foreignKeys.length > 0) throw new Error("The database backup foreign-key check failed.");
    const schemaErrors = schemaContractErrors(database);
    if (schemaErrors.length) throw new Error(`The database backup schema is incomplete: ${schemaErrors.join("; ")}`);
  } finally {
    database.close();
  }
}
