import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDatabase } from "./db";

export const permissionCodes = [
  "goals.view", "goals.edit", "actions.view", "actions.create", "actions.edit-own",
  "actions.edit-department", "actions.progress", "kpis.manage", "risks.manage",
  "dependencies.manage", "organization.manage", "reports.view", "reports.export",
  "users.manage", "permissions.manage"
] as const;

export type PermissionCode = (typeof permissionCodes)[number];
export type DataScope = "COMPANY" | "DEPARTMENT" | "OWN";
export type SessionUser = {
  id: string;
  username: string;
  person_id?: string;
  department_id?: string;
  role: string;
  scope: DataScope;
};

const loginAttempts = new Map<string, { failures: number; firstFailureAt: number }>();
export const LOGIN_RATE_LIMIT = { maxFailures: 5, windowMs: 15 * 60 * 1000 };

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export function hashPasswordForStorage(password: string) {
  if (password.length < 8) throw new Error("Password must contain at least 8 characters.");
  return hashPassword(password);
}

export function loginRateLimitKey(username: string, clientKey: string) {
  return `${clientKey}:${username.trim().toLowerCase()}`;
}

export function isLoginRateLimited(key: string, now = Date.now()) {
  const attempt = loginAttempts.get(key);
  if (!attempt) return false;
  if (now - attempt.firstFailureAt >= LOGIN_RATE_LIMIT.windowMs) {
    loginAttempts.delete(key);
    return false;
  }
  return attempt.failures >= LOGIN_RATE_LIMIT.maxFailures;
}

export function recordLoginFailure(key: string, now = Date.now()) {
  const current = loginAttempts.get(key);
  if (!current || now - current.firstFailureAt >= LOGIN_RATE_LIMIT.windowMs) {
    loginAttempts.set(key, { failures: 1, firstFailureAt: now });
    return;
  }
  current.failures += 1;
}

export function clearLoginFailures(key: string) {
  loginAttempts.delete(key);
}

export function resetLoginRateLimitForTests() {
  loginAttempts.clear();
}

export function seedAuthFoundation() {
  const db = getDatabase();
  const insertRole = db.prepare("INSERT OR IGNORE INTO app_roles (id, code, title, scope) VALUES (?, ?, ?, ?)");
  const roles: Array<[string, string, string, DataScope]> = [
    ["role-super-admin", "SUPER_ADMIN", "مدیر ارشد سامانه", "COMPANY"],
    ["role-admin", "ADMIN", "مدیر سامانه", "COMPANY"],
    ["role-management", "MANAGEMENT", "مدیریت", "COMPANY"],
    ["role-unit-manager", "UNIT_MANAGER", "مدیر واحد", "DEPARTMENT"],
    ["role-project-owner", "PROJECT_OWNER", "مالک پروژه", "OWN"],
    ["role-employee", "EMPLOYEE", "کارمند", "OWN"],
    ["role-viewer", "VIEWER", "مشاهده‌گر", "COMPANY"]
  ];
  for (const role of roles) insertRole.run(...role);
  const updateRoleScope = db.prepare("UPDATE app_roles SET scope = ?, title = ? WHERE code = ?");
  for (const [, code, title, scope] of roles) updateRoleScope.run(scope, title, code);
  const insertPermission = db.prepare("INSERT OR IGNORE INTO permissions (id, code, title) VALUES (?, ?, ?)");
  for (const code of permissionCodes) insertPermission.run(`permission-${code}`, code, code);
  const all = db.prepare("SELECT id FROM permissions").all() as Array<{ id: string }>;
  const rolePermissionMap: Record<string, PermissionCode[]> = {
    SUPER_ADMIN: [...permissionCodes],
    ADMIN: [...permissionCodes],
    MANAGEMENT: ["goals.view", "actions.view", "kpis.manage", "risks.manage", "dependencies.manage", "reports.view", "reports.export"],
    UNIT_MANAGER: ["goals.view", "actions.view", "actions.create", "actions.edit-department", "actions.progress", "kpis.manage", "risks.manage", "dependencies.manage", "reports.view"],
    PROJECT_OWNER: ["goals.view", "actions.view", "actions.create", "actions.edit-own", "actions.progress", "kpis.manage", "risks.manage", "dependencies.manage", "reports.view"],
    EMPLOYEE: ["goals.view", "actions.view", "actions.edit-own", "actions.progress", "reports.view"],
    VIEWER: ["goals.view", "actions.view", "reports.view"]
  };
  const roleRows = db.prepare("SELECT id, code FROM app_roles").all() as Array<{ id: string; code: string }>;
  const assign = db.prepare("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
  for (const role of roleRows) {
    for (const code of rolePermissionMap[role.code] ?? []) {
      const permission = all.find((candidate) => candidate.id === `permission-${code}`);
      if (permission) assign.run(role.id, permission.id);
    }
  }
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get("admin");
  if (!existing) {
    db.prepare("INSERT INTO users (id, username, password_hash, role_id) VALUES (?, ?, ?, ?)").run(
      randomUUID(), "admin", hashPassword(process.env.PULSE_ADMIN_PASSWORD ?? "pulse-local-change-me"), "role-super-admin"
    );
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("pulse_session")?.value;
  if (!token) return null;
  return getDatabase().prepare(`
    SELECT u.id, u.username, u.person_id, u.department_id, r.code AS role, r.scope
    FROM sessions s JOIN users u ON u.id = s.user_id JOIN app_roles r ON r.id = u.role_id
    WHERE s.id = ? AND u.active = 1 AND s.expires_at > datetime('now')
  `).get(token) as SessionUser | undefined ?? null;
}

export async function login(username: string, password: string) {
  const row = getDatabase().prepare("SELECT id, password_hash FROM users WHERE username = ? AND active = 1").get(username) as { id: string; password_hash: string } | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) return false;
  const token = randomBytes(32).toString("hex");
  getDatabase().prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+8 hours'))").run(token, row.id);
  const cookieStore = await cookies();
  cookieStore.set("pulse_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  return true;
}

export function can(permission: PermissionCode, role?: string | null) {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
  return Boolean(getDatabase().prepare(`
    SELECT 1 FROM role_permissions rp
    JOIN app_roles r ON r.id = rp.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE r.code = ? AND p.code = ?
  `).get(role ?? "", permission));
}

export function canScope(user: SessionUser, record: { ownerPersonId?: string | null; departmentId?: string | null }) {
  if (user.scope === "COMPANY" || user.role === "SUPER_ADMIN" || user.role === "ADMIN" || user.role === "MANAGEMENT") return true;
  if (user.scope === "DEPARTMENT") return Boolean(user.department_id && user.department_id === record.departmentId);
  return Boolean(user.person_id && user.person_id === record.ownerPersonId);
}

export function audit(actorUserId: string | null, entityType: string, entityId: string, eventType: string, before?: unknown, after?: unknown) {
  getDatabase().prepare(`
    INSERT INTO audit_log (id, actor_user_id, entity_type, entity_id, event_type, before_json, after_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), actorUserId, entityType, entityId, eventType, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null);
}
