import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const cookieValues = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = cookieValues.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      cookieValues.set(name, value);
    }
  }))
}));

import { POST } from "./route";
import { csrfCookieName, csrfHeaderName } from "../../../_lib";
import { closeDatabase, getDatabase } from "../../../../../server/db";
import { seedBaseline } from "../../../../../server/seed";
import { hashPasswordForStorage, seedAuthFoundation } from "../../../../../server/auth";
import { XlsxWorkbookReader } from "../../../../../application/import/spreadsheet/xlsx";
import { SpreadsheetMappingEngine } from "../../../../../application/import/spreadsheet/mapping";
import { ImportReviewService } from "../../../../../application/import/staging";
import { SQLiteImportJobRepository, SQLiteImportRecordRepository } from "../../../../../server/import/SQLiteImportRepositories";
import { programFixture } from "../../../../../domain/program";

const sourceName = "Annual program supplies - برنامه سال 1405 - تدارکات -اصلاحی (1).xlsx";
const csrfToken = "http-acceptance-csrf-token";
let databasePath = "";

beforeEach(() => {
  closeDatabase();
  cookieValues.clear();
  databasePath = path.join(os.tmpdir(), `pulse-departmental-http-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
  process.env.PULSE_DB_PATH = databasePath;
  process.env.PULSE_ADMIN_PASSWORD = "http-acceptance-password";
  seedBaseline();
  seedAuthFoundation();
  const database = getDatabase();
  database.prepare("INSERT INTO users (id, username, password_hash, role_id) VALUES (?, ?, ?, ?)")
    .run("http-authorized", "http-authorized", hashPasswordForStorage("http-authorized-password"), "role-super-admin");
  database.prepare("INSERT INTO users (id, username, password_hash, role_id) VALUES (?, ?, ?, ?)")
    .run("http-unauthorized", "http-unauthorized", hashPasswordForStorage("http-unauthorized-password"), "role-viewer");
  database.prepare("INSERT INTO users (id, username, password_hash, role_id, active) VALUES (?, ?, ?, ?, 0)")
    .run("http-inactive", "http-inactive", hashPasswordForStorage("http-inactive-password"), "role-super-admin");
});

afterEach(async () => {
  closeDatabase();
  for (const file of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    await fs.rm(file, { force: true });
  }
});

async function approvedJob(id: string, status: "APPROVED" | "DRAFT" = "APPROVED") {
  const bytes = await fs.readFile(path.join(process.cwd(), "Samples", sourceName));
  const workbook = await new XlsxWorkbookReader().read(bytes, { name: sourceName });
  const records = new SpreadsheetMappingEngine({ sourceName }).map(workbook);
  const review = new ImportReviewService(undefined, new SQLiteImportJobRepository(), new SQLiteImportRecordRepository());
  review.createJob({
    type: "EXCEL",
    name: sourceName,
    metadata: { planYear: 1405, classification: "SUPPORTING", domain: "procurement" }
  }, id);
  review.attachRecords(id, records);
  review.analyze(id, programFixture);
  if (status === "APPROVED") review.approve(id);
  return id;
}

function sessionFor(userId: string) {
  const sessionId = `http-session-${userId}-${Math.random().toString(36).slice(2)}`;
  getDatabase().prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+8 hours'))")
    .run(sessionId, userId);
  cookieValues.set("pulse_session", sessionId);
}

function request(importJobId: string, options: { csrf?: string } = {}) {
  cookieValues.set(csrfCookieName, csrfToken);
  return POST(
    new Request(`http://localhost/api/imports/${importJobId}/materializations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.csrf === undefined ? { [csrfHeaderName]: csrfToken } : { [csrfHeaderName]: options.csrf })
      },
      body: JSON.stringify({ materializationKind: "DEPARTMENTAL", targetPlanYear: 1405 })
    }),
    { params: Promise.resolve({ id: importJobId }) }
  );
}

describe("POST /api/imports/[id]/materializations HTTP acceptance", () => {
  it("materializes through the authenticated route and is idempotent on repeat", async () => {
    const importJobId = await approvedJob("http-approved");
    sessionFor("http-authorized");

    const first = await request(importJobId);
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    expect(firstBody.departmental).toMatchObject({
      duplicate: false,
      recordCount: 500,
      provenanceCount: expect.any(Number),
      operationId: expect.stringMatching(/^departmental-materialization-/),
      sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/)
    });

    const second = await request(importJobId);
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.departmental).toEqual({
      ...firstBody.departmental,
      duplicate: true
    });

    const database = getDatabase();
    expect(database.prepare("SELECT COUNT(*) AS count FROM departmental_planning_records").get()).toEqual({ count: 500 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM departmental_materialization_operations").get()).toEqual({ count: 1 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM departmental_planning_records WHERE provenance_json IS NOT NULL AND length(provenance_json) > 2").get()).toEqual({ count: 500 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM departmental_materialization_operations WHERE source_fingerprint = ?").get(firstBody.departmental.sourceFingerprint)).toEqual({ count: 1 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE entity_type = 'departmental-materialization' AND event_type = 'departmental_materialization_completed'").get()).toEqual({ count: 1 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM strategic_goals").get()).toEqual({ count: 10 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM sub_goals").get()).toEqual({ count: 0 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM activities").get()).toEqual({ count: 0 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM work_items").get()).toEqual({ count: 6 });

    closeDatabase();
    const reopened = getDatabase();
    expect(reopened.prepare("SELECT COUNT(*) AS count FROM departmental_planning_records").get()).toEqual({ count: 500 });
    expect(reopened.prepare("SELECT COUNT(*) AS count FROM departmental_materialization_operations").get()).toEqual({ count: 1 });
  }, 60_000);

  it("rejects unauthenticated, CSRF-invalid, unauthorized, unapproved, and inactive requests", async () => {
    const approved = await approvedJob("http-security-approved");

    const unauthenticated = await request(approved);
    expect(unauthenticated.status).toBe(401);
    expect((await unauthenticated.json()).code).toBe("UNAUTHORIZED");

    sessionFor("http-authorized");
    const missingCsrf = await request(approved, { csrf: "" });
    expect(missingCsrf.status).toBe(403);
    expect((await missingCsrf.json()).code).toBe("FORBIDDEN");

    cookieValues.clear();
    sessionFor("http-unauthorized");
    const unauthorized = await request(approved);
    expect(unauthorized.status).toBe(403);
    expect((await unauthorized.json()).code).toBe("FORBIDDEN");

    cookieValues.clear();
    sessionFor("http-authorized");
    const unapproved = await request(await approvedJob("http-security-unapproved", "DRAFT"));
    expect(unapproved.status).toBe(500);
    expect((await unapproved.json()).code).toBe("INTERNAL_ERROR");

    cookieValues.clear();
    sessionFor("http-inactive");
    const inactive = await request(approved);
    expect(inactive.status).toBe(401);
    expect((await inactive.json()).code).toBe("UNAUTHORIZED");

    expect(getDatabase().prepare("SELECT COUNT(*) AS count FROM departmental_planning_records").get()).toEqual({ count: 0 });
    expect(getDatabase().prepare("SELECT COUNT(*) AS count FROM departmental_materialization_operations").get()).toEqual({ count: 0 });
  }, 60_000);

  it("returns an HTTP error and rolls back all writes on a controlled persistence failure", async () => {
    const importJobId = await approvedJob("http-rollback");
    sessionFor("http-authorized");
    getDatabase().exec("CREATE TRIGGER http_acceptance_failure AFTER INSERT ON departmental_planning_records BEGIN SELECT RAISE(ABORT, 'controlled HTTP acceptance failure'); END");

    const response = await request(importJobId);
    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe("INTERNAL_ERROR");

    getDatabase().exec("DROP TRIGGER http_acceptance_failure");
    expect(getDatabase().prepare("SELECT COUNT(*) AS count FROM departmental_materialization_operations").get()).toEqual({ count: 0 });
    expect(getDatabase().prepare("SELECT COUNT(*) AS count FROM departmental_planning_records").get()).toEqual({ count: 0 });
    expect(getDatabase().prepare("SELECT COUNT(*) AS count FROM audit_log WHERE entity_type = 'departmental-materialization'").get()).toEqual({ count: 0 });
  }, 60_000);
});
