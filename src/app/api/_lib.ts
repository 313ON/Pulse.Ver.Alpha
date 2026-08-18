import { NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { seedBaseline } from "../../server/seed";
import { RepositoryError } from "../../server/repositories";
import { audit, can, canScope, getSessionUser, seedAuthFoundation, secureCookiesEnabled, type PermissionCode, type SessionUser } from "../../server/auth";

export class AuthorizationError extends Error {
  constructor(public code: "UNAUTHORIZED" | "FORBIDDEN", message: string) {
    super(message);
  }
}

export function authorizationStatus(code: AuthorizationError["code"]) {
  return code === "UNAUTHORIZED" ? 401 : 403;
}

export const csrfCookieName = "pulse_csrf";
export const csrfHeaderName = "x-csrf-token";

export function ensureRuntimeData(): void {
  seedBaseline();
  seedAuthFoundation();
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthorizationError) {
    return json({ error: error.message, code: error.code }, { status: authorizationStatus(error.code) });
  }
  if (error instanceof RepositoryError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "DUPLICATE" || error.code === "VALIDATION" ? 400 : 500;
    return json({ error: error.message, code: error.code }, { status });
  }
  return json({ error: "The request could not be completed.", code: "INTERNAL_ERROR" }, { status: 500 });
}

export async function issueCsrfToken() {
  const token = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(csrfCookieName, token, {
    httpOnly: false,
    sameSite: "lax",
    secure: secureCookiesEnabled(),
    path: "/",
    maxAge: 60 * 60 * 8
  });
  return token;
}

export async function requireCsrf(request: Request) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(csrfCookieName)?.value;
  const headerToken = request.headers.get(csrfHeaderName);
  if (!cookieToken || !headerToken) throw new AuthorizationError("FORBIDDEN", "درخواست امنیتی معتبر نیست.");
  if (!csrfTokensMatch(cookieToken, headerToken)) {
    throw new AuthorizationError("FORBIDDEN", "درخواست امنیتی معتبر نیست.");
  }
}

export function csrfTokensMatch(expectedToken: string, actualToken: string) {
  const expected = Buffer.from(expectedToken);
  const actual = Buffer.from(actualToken);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function readJson(request: Request, options: { csrf?: boolean } = {}): Promise<Record<string, unknown>> {
  if (options.csrf !== false) await requireCsrf(request);
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
    return body as Record<string, unknown>;
  } catch {
    throw new RepositoryError("VALIDATION", "The request body is invalid.");
  }
}

export async function requirePermission(permission: PermissionCode) {
  const user = await getSessionUser();
  if (!user) throw new AuthorizationError("UNAUTHORIZED", "برای انجام این عملیات وارد سامانه شوید.");
  if (!can(permission, user.role)) throw new AuthorizationError("FORBIDDEN", "شما مجوز انجام این عملیات را ندارید.");
  return user;
}

export async function requireAccess(permission: PermissionCode, record?: { ownerPersonId?: string | null; departmentId?: string | null }) {
  const user = await requirePermission(permission);
  if (record && !canScope(user, record)) throw new AuthorizationError("FORBIDDEN", "دسترسی شما به این رکورد مجاز نیست.");
  return user;
}

export function auditMutation(user: SessionUser, entityType: string, entityId: string, eventType: string, before: unknown, after: unknown) {
  audit(user.id, entityType, entityId, eventType, before, after);
}
