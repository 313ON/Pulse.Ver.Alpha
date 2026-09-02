import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { getDatabase } from "./db";
import { audit, hashPasswordForStorage, rotateAdminPassword } from "./auth";

export const DEVELOPER_ADMIN_RESET_FLAG = "PULSE_ALLOW_DEVELOPER_ADMIN_RESET";
export const DEVELOPER_ADMIN_RESET_EVENT = "admin-password-reset";
export const DEVELOPER_DATABASE_RELATIVE_PATH = path.join("db", "pulse.sqlite");

type RecoveryEnvironment = Record<string, string | undefined>;
type AuditWriter = typeof audit;
type PasswordRotator = typeof rotateAdminPassword;

export type DeveloperAdminRecoveryOptions = {
  environment?: RecoveryEnvironment;
  workingDirectory?: string;
  database?: Database.Database;
  rotatePassword?: PasswordRotator;
  writeAudit?: AuditWriter;
};

export type DeveloperAdminRecoveryResult = {
  adminId: string;
  username: "admin";
  eventType: typeof DEVELOPER_ADMIN_RESET_EVENT;
  databasePath: string;
};

export function resolveDeveloperDatabasePath(
  workingDirectory = process.cwd(),
  environment: RecoveryEnvironment = process.env
): string {
  if (environment.PULSE_DB_PATH?.trim()) {
    throw new Error("Developer admin recovery refuses configured PULSE_DB_PATH.");
  }
  return path.resolve(workingDirectory, DEVELOPER_DATABASE_RELATIVE_PATH);
}

export function assertDeveloperRecoveryEnvironment(
  workingDirectory = process.cwd(),
  environment: RecoveryEnvironment = process.env
): string {
  if (environment.NODE_ENV === "production") {
    throw new Error("Developer admin recovery is prohibited in production.");
  }
  if (environment.NODE_ENV !== "development") {
    throw new Error("Developer admin recovery requires NODE_ENV=development.");
  }
  if (environment[DEVELOPER_ADMIN_RESET_FLAG] !== "1") {
    throw new Error(`Set ${DEVELOPER_ADMIN_RESET_FLAG}=1 to opt in explicitly.`);
  }
  const databasePath = resolveDeveloperDatabasePath(workingDirectory, environment);
  if (!fs.existsSync(databasePath)) {
    throw new Error("The developer database does not exist.");
  }
  return databasePath;
}

function validatePassword(password: string): void {
  if (!password || password.trim().length === 0) {
    throw new Error("A non-empty developer password is required.");
  }
  // Reuse the application boundary so the command cannot drift from auth rules.
  hashPasswordForStorage(password);
}

export function recoverDeveloperAdminPassword(
  password: string,
  options: DeveloperAdminRecoveryOptions = {}
): DeveloperAdminRecoveryResult {
  const environment = options.environment ?? process.env;
  const workingDirectory = options.workingDirectory ?? process.cwd();
  const databasePath = assertDeveloperRecoveryEnvironment(workingDirectory, environment);
  validatePassword(password);

  const database = options.database ?? getDatabase();
  const rotate = options.rotatePassword ?? rotateAdminPassword;
  const writeAudit = options.writeAudit ?? audit;
  const admin = database.prepare(`
    SELECT u.id, u.username, u.active, r.code AS role
    FROM users u JOIN app_roles r ON r.id = u.role_id
    WHERE u.username = ?
  `).get("admin") as { id: string; username: string; active: number; role: string } | undefined;

  if (!admin) throw new Error("The existing admin account was not found.");
  if (admin.username !== "admin" || admin.active !== 1 || admin.role !== "SUPER_ADMIN") {
    throw new Error("The existing admin account is not the expected active SUPER_ADMIN.");
  }

  const reset = database.transaction(() => {
    rotate(password);
    writeAudit(
      null,
      "user",
      admin.id,
      DEVELOPER_ADMIN_RESET_EVENT,
      { username: "admin", operator: "developer-maintenance" },
      { username: "admin", operator: "developer-maintenance" }
    );
  });
  reset();

  return {
    adminId: admin.id,
    username: "admin",
    eventType: DEVELOPER_ADMIN_RESET_EVENT,
    databasePath
  };
}
