import { beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "./db";
import { canScope, clearLoginFailures, hashPasswordForStorage, isLoginRateLimited, loginRateLimitKey, recordLoginFailure, resetLoginRateLimitForTests, rotateAdminPassword, secureCookiesEnabled, seedAuthFoundation, verifyPassword, type SessionUser } from "./auth";
import { authorizationStatus, csrfTokensMatch, ensureRuntimeData } from "../app/api/_lib";
import { seedBaseline } from "./seed";

beforeEach(() => {
  closeDatabase();
  process.env.PULSE_DB_PATH = `:memory:`;
  process.env.PULSE_ADMIN_PASSWORD = "test-admin-password-123";
  seedBaseline();
  seedAuthFoundation();
});

describe("authentication and scopes", () => {
  it("hashes passwords without storing plaintext and verifies them", () => {
    const stored = hashPasswordForStorage("safe-password-123");
    expect(stored).not.toContain("safe-password-123");
    expect(verifyPassword("safe-password-123", stored)).toBe(true);
    expect(verifyPassword("wrong-password", stored)).toBe(false);
  });
  it("enforces company, department, and own data scopes", () => {
    const company = { id: "1", username: "m", role: "MANAGEMENT", scope: "COMPANY" } as SessionUser;
    const unit = { id: "2", username: "u", role: "UNIT_MANAGER", scope: "DEPARTMENT", department_id: "it" } as SessionUser;
    const employee = { id: "3", username: "e", role: "EMPLOYEE", scope: "OWN", person_id: "it-engineer" } as SessionUser;
    expect(canScope(company, { departmentId: "other", ownerPersonId: "other" })).toBe(true);
    expect(canScope(unit, { departmentId: "it", ownerPersonId: "other" })).toBe(true);
    expect(canScope(unit, { departmentId: "other", ownerPersonId: "other" })).toBe(false);
    expect(canScope(employee, { departmentId: "it", ownerPersonId: "it-engineer" })).toBe(true);
    expect(canScope(employee, { departmentId: "it", ownerPersonId: "other" })).toBe(false);
  });
  it("uses distinct authorization status semantics", () => {
    expect(authorizationStatus("UNAUTHORIZED")).toBe(401);
    expect(authorizationStatus("FORBIDDEN")).toBe(403);
  });
  it("validates CSRF tokens using constant-time compatible matching", () => {
    expect(csrfTokensMatch("csrf-token", "csrf-token")).toBe(true);
    expect(csrfTokensMatch("csrf-token", "wrong-token")).toBe(false);
    expect(csrfTokensMatch("csrf-token", "csrf-token-extra")).toBe(false);
  });
  it("enables secure cookies only when HTTPS is explicitly configured", () => {
    const previous = process.env.PULSE_HTTPS;
    delete process.env.PULSE_HTTPS;
    expect(secureCookiesEnabled()).toBe(false);
    process.env.PULSE_HTTPS = "false";
    expect(secureCookiesEnabled()).toBe(false);
    process.env.PULSE_HTTPS = "true";
    expect(secureCookiesEnabled()).toBe(true);
    if (previous === undefined) delete process.env.PULSE_HTTPS;
    else process.env.PULSE_HTTPS = previous;
  });
  it("limits repeated login failures and clears the limit after success", () => {
    resetLoginRateLimitForTests();
    const key = loginRateLimitKey("admin", "test-client");
    expect(isLoginRateLimited(key)).toBe(false);
    for (let index = 0; index < 5; index += 1) recordLoginFailure(key);
    expect(isLoginRateLimited(key)).toBe(true);
    clearLoginFailures(key);
    expect(isLoginRateLimited(key)).toBe(false);
  });
  it("does not create a bootstrap administrator without an explicit password", () => {
    closeDatabase();
    process.env.PULSE_DB_PATH = ":memory:";
    delete process.env.PULSE_ADMIN_PASSWORD;
    expect(() => ensureRuntimeData()).toThrow(/PULSE_ADMIN_PASSWORD must be configured/);
    expect(getDatabase().prepare("SELECT COUNT(*) AS count FROM app_roles").get()).toEqual({ count: 0 });
    expect(getDatabase().prepare("SELECT COUNT(*) AS count FROM permissions").get()).toEqual({ count: 0 });
    process.env.PULSE_ADMIN_PASSWORD = "test-admin-password-123";
  });
  it("rotates an existing administrator password through the hashing boundary", () => {
    const before = getDatabase().prepare("SELECT password_hash FROM users WHERE username = 'admin'").get() as { password_hash: string };
    rotateAdminPassword("rotated-admin-password-123");
    const after = getDatabase().prepare("SELECT password_hash FROM users WHERE username = 'admin'").get() as { password_hash: string };

    expect(after.password_hash).not.toBe(before.password_hash);
    expect(verifyPassword("rotated-admin-password-123", after.password_hash)).toBe(true);
    expect(verifyPassword("test-admin-password-123", after.password_hash)).toBe(false);
  });
  it("keeps governance audit events append-only", () => {
    const db = getDatabase();
    const actor = db.prepare("SELECT id FROM users WHERE username = 'admin'").get() as { id: string };
    db.prepare("INSERT INTO audit_log (id, actor_user_id, entity_type, entity_id, event_type) VALUES (?, ?, ?, ?, ?)").run("audit-immutable", actor.id, "import-review", "job-1", "approved");
    expect(() => db.prepare("UPDATE audit_log SET event_type = 'tampered' WHERE id = ?").run("audit-immutable")).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM audit_log WHERE id = ?").run("audit-immutable")).toThrow(/append-only/);
  });
});
