import { beforeEach, describe, expect, it } from "vitest";
import { closeDatabase } from "./db";
import { canScope, clearLoginFailures, hashPasswordForStorage, isLoginRateLimited, loginRateLimitKey, recordLoginFailure, resetLoginRateLimitForTests, secureCookiesEnabled, seedAuthFoundation, verifyPassword, type SessionUser } from "./auth";
import { authorizationStatus, csrfTokensMatch } from "../app/api/_lib";
import { seedBaseline } from "./seed";

beforeEach(() => {
  closeDatabase();
  process.env.PULSE_DB_PATH = `:memory:`;
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
});
