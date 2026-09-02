import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertDeveloperRecoveryEnvironment,
  DEVELOPER_ADMIN_RESET_EVENT,
  recoverDeveloperAdminPassword,
  resolveDeveloperDatabasePath
} from "./developerAdminRecovery";
import { hashPasswordForStorage, verifyPassword } from "./auth";

const schema = fs.readFileSync(path.join(process.cwd(), "db", "schema.sqlite.sql"), "utf8");
const originalEnvironment = { ...process.env };
const temporaryDatabasePaths: string[] = [];

function isolatedDatabase(): Database.Database {
  const databasePath = path.join(os.tmpdir(), `pulse-developer-admin-${Date.now()}-${Math.random()}.sqlite`);
  temporaryDatabasePaths.push(databasePath);
  const database = new Database(databasePath);
  database.exec(schema);
  database.prepare("INSERT INTO app_roles (id, code, title, scope) VALUES (?, ?, ?, ?)").run("role-super-admin", "SUPER_ADMIN", "Super admin", "COMPANY");
  database.prepare("INSERT INTO users (id, username, password_hash, role_id) VALUES (?, ?, ?, ?)").run(
    "admin-id",
    "admin",
    hashPasswordForStorage("old-password-123"),
    "role-super-admin"
  );
  return database;
}

function developerEnvironment() {
  return {
    NODE_ENV: "development",
    [("PULSE_ALLOW_DEVELOPER_ADMIN_RESET")]: "1"
  };
}

beforeEach(() => {
  process.env = { ...originalEnvironment };
});

afterEach(() => {
  process.env = { ...originalEnvironment };
  for (const databasePath of temporaryDatabasePaths.splice(0)) {
    fs.rmSync(databasePath, { force: true });
    fs.rmSync(`${databasePath}-wal`, { force: true });
    fs.rmSync(`${databasePath}-shm`, { force: true });
  }
});

describe("developer admin recovery contract", () => {
  it("resolves the actual npm command's TypeScript server dependency chain", () => {
    const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", "npm.cmd run admin:reset:developer"]
      : ["run", "admin:reset:developer"];
    const result = spawnSync(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "development", PULSE_ALLOW_DEVELOPER_ADMIN_RESET: undefined },
      encoding: "utf8",
      input: ""
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    expect(result.status).not.toBe(0);
    expect(result.error).toBeUndefined();
    expect(output).toContain("Set PULSE_ALLOW_DEVELOPER_ADMIN_RESET=1 to opt in explicitly.");
    expect(output).not.toContain("ERR_MODULE_NOT_FOUND");
  });

  it("resets only the existing admin in an isolated database and authenticates with the new password", () => {
    const database = isolatedDatabase();
    const result = recoverDeveloperAdminPassword("new-password-123", {
      environment: developerEnvironment(),
      workingDirectory: process.cwd(),
      database,
      rotatePassword: (password) => {
        database.prepare("UPDATE users SET password_hash = ? WHERE username = 'admin'").run(hashPasswordForStorage(password));
      },
      writeAudit: (actorUserId, entityType, entityId, eventType, before, after) => {
        database.prepare(`
          INSERT INTO audit_log (id, actor_user_id, entity_type, entity_id, event_type, before_json, after_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run("developer-reset-audit", actorUserId, entityType, entityId, eventType, JSON.stringify(before), JSON.stringify(after));
      }
    });

    const stored = database.prepare("SELECT password_hash FROM users WHERE username = 'admin'").get() as { password_hash: string };
    expect(verifyPassword("new-password-123", stored.password_hash)).toBe(true);
    expect(verifyPassword("old-password-123", stored.password_hash)).toBe(false);
    expect(database.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 1 });
    expect(result.eventType).toBe(DEVELOPER_ADMIN_RESET_EVENT);
    expect(database.prepare("SELECT event_type, entity_type, entity_id, before_json, after_json FROM audit_log").get()).toMatchObject({
      event_type: DEVELOPER_ADMIN_RESET_EVENT,
      entity_type: "user",
      entity_id: "admin-id"
    });
    const auditRow = database.prepare("SELECT before_json, after_json FROM audit_log").get() as { before_json: string; after_json: string };
    expect(`${auditRow.before_json}${auditRow.after_json}`).not.toContain("new-password-123");
    expect(`${auditRow.before_json}${auditRow.after_json}`).not.toContain("password_hash");
    database.close();
  });

  it.each(["", "        "])("rejects invalid password %j before mutation", (password) => {
    const database = isolatedDatabase();
    expect(() => recoverDeveloperAdminPassword(password, {
      environment: developerEnvironment(),
      database,
      rotatePassword: () => {
        throw new Error("must not mutate");
      }
    })).toThrow();
    const stored = database.prepare("SELECT password_hash FROM users WHERE username = 'admin'").get() as { password_hash: string };
    expect(verifyPassword("old-password-123", stored.password_hash)).toBe(true);
    expect(database.prepare("SELECT COUNT(*) AS count FROM audit_log").get()).toEqual({ count: 0 });
    database.close();
  });

  it("rejects production before opening or mutating a database", () => {
    const databasePath = path.join(os.tmpdir(), `pulse-production-reset-${Date.now()}.sqlite`);
    expect(() => assertDeveloperRecoveryEnvironment(process.cwd(), {
      NODE_ENV: "production",
      PULSE_ALLOW_DEVELOPER_ADMIN_RESET: "1"
    })).toThrow(/prohibited in production/);
    expect(fs.existsSync(databasePath)).toBe(false);
  });

  it("requires explicit opt-in", () => {
    expect(() => assertDeveloperRecoveryEnvironment(process.cwd(), { NODE_ENV: "development" }))
      .toThrow(/opt in explicitly/);
  });

  it("rejects unexpected database configuration", () => {
    expect(() => resolveDeveloperDatabasePath(process.cwd(), {
      NODE_ENV: "development",
      PULSE_ALLOW_DEVELOPER_ADMIN_RESET: "1",
      PULSE_DB_PATH: path.join(os.tmpdir(), "unexpected.sqlite")
    })).toThrow(/configured PULSE_DB_PATH/);
  });

  it("rejects a missing admin and does not create users", () => {
    const database = new Database(":memory:");
    database.exec(schema);
    expect(() => recoverDeveloperAdminPassword("new-password-123", {
      environment: developerEnvironment(),
      database,
      rotatePassword: () => {
        throw new Error("must not mutate");
      }
    })).toThrow(/admin account was not found/);
    expect(database.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 0 });
    database.close();
  });

  it("rolls back the password update when audit insertion fails", () => {
    const database = isolatedDatabase();
    expect(() => recoverDeveloperAdminPassword("new-password-123", {
      environment: developerEnvironment(),
      database,
      rotatePassword: (password) => {
        database.prepare("UPDATE users SET password_hash = ? WHERE username = 'admin'").run(hashPasswordForStorage(password));
      },
      writeAudit: () => {
        throw new Error("audit unavailable");
      }
    })).toThrow("audit unavailable");
    const stored = database.prepare("SELECT password_hash FROM users WHERE username = 'admin'").get() as { password_hash: string };
    expect(verifyPassword("old-password-123", stored.password_hash)).toBe(true);
    expect(verifyPassword("new-password-123", stored.password_hash)).toBe(false);
    expect(database.prepare("SELECT COUNT(*) AS count FROM audit_log").get()).toEqual({ count: 0 });
    database.close();
  });
});
