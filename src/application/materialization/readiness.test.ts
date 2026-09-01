import { beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "../../server/db";
import { seedBaseline } from "../../server/seed";
import { seedAuthFoundation } from "../../server/auth";
import { MaterializationApplicationService } from "./service";

beforeEach(() => {
  closeDatabase();
  process.env.PULSE_DB_PATH = ":memory:";
  process.env.PULSE_ADMIN_PASSWORD = "r10-e2-password";
  seedBaseline();
  seedAuthFoundation();
});

describe("R10-E.2 operator read model", () => {
  it("blocks an unapproved import without selecting another import", () => {
    const db = getDatabase();
    db.prepare("INSERT INTO import_jobs (id, source_json, status, created_at, analysis_revision) VALUES (?, ?, ?, ?, ?)")
      .run("import-review", JSON.stringify({ type: "EXCEL", name: "review.xlsx", metadata: { planYear: 1405 } }), "REVIEW_REQUIRED", "2026-08-26T00:00:00.000Z", 1);
    const readiness = new MaterializationApplicationService().readiness("import-review", 1405);
    expect(readiness.status).toBe("BLOCKED");
    expect(readiness.importJobId).toBe("import-review");
    expect(readiness.blockers[0]?.code).toBe("NOT_APPROVED");
    expect(readiness.operations).toEqual([]);
  });

  it("returns an approved snapshot and deterministic ready plan", () => {
    const db = getDatabase();
    const source = { type: "EXCEL", name: "approved.xlsx", metadata: { planYear: 1405 } };
    db.prepare("INSERT INTO import_jobs (id, source_json, status, created_at, approved_at, analysis_revision, validation_json, assessment_json, quality_score_json) VALUES (?, ?, 'APPROVED', ?, ?, 1, ?, ?, ?)")
      .run("import-approved", JSON.stringify(source), "2026-08-26T00:00:00.000Z", "2026-08-26T01:00:00.000Z", JSON.stringify({ valid: true, errors: [], warnings: [], normalizedData: [] }), JSON.stringify({ governance: { errors: [] }, findings: [] }), JSON.stringify({ overallScore: 100, dimensions: {}, findings: [] }));
    const readiness = new MaterializationApplicationService().readiness("import-approved", 1405);
    expect(readiness.status).toBe("READY");
    expect(readiness.snapshot).toMatchObject({ importJobId: "import-approved", approvedAnalysisRevision: 1, sourceRecordCount: 0 });
    expect(readiness.plan?.planHash).toMatch(/^[a-f0-9]{64}$/);
    expect(readiness.blockers).toEqual([]);
  });

  it("returns audit only for the explicit import and operation", () => {
    const db = getDatabase();
    db.prepare("INSERT INTO audit_log (id, entity_type, entity_id, event_type) VALUES ('review-audit', 'import-review', 'import-audit', 'approved')").run();
    db.prepare("INSERT INTO import_jobs (id, source_json, status, created_at, analysis_revision) VALUES ('import-audit', '{}', 'APPROVED', '2026-08-26T00:00:00.000Z', 1)").run();
    const events = new MaterializationApplicationService().audit("import-audit");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ entityId: "import-audit", eventType: "approved" });
  });
});
