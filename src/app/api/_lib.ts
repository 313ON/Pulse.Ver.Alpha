import { NextResponse } from "next/server";
import { seedBaseline } from "../../server/seed";
import { RepositoryError } from "../../server/repositories";

export function ensureRuntimeData(): void {
  seedBaseline();
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function handleApiError(error: unknown) {
  if (error instanceof RepositoryError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "DUPLICATE" || error.code === "VALIDATION" ? 400 : 500;
    return json({ error: error.message, code: error.code }, { status });
  }
  return json({ error: "The request could not be completed.", code: "INTERNAL_ERROR" }, { status: 500 });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
    return body as Record<string, unknown>;
  } catch {
    throw new RepositoryError("VALIDATION", "The request body is invalid.");
  }
}
