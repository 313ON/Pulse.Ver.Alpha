import { beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "../../server/db";
import { seedBaseline } from "../../server/seed";
import { seedAuthFoundation, can } from "../../server/auth";
import { applyMaterializationFoundationMigration } from "../../server/materialization/migration";
import { SQLiteMaterializationRepository } from "../../server/materialization/SQLiteMaterializationRepository";
import { createImportSnapshotReference } from "./snapshot";
import { materializationPlanHash, type MaterializationPlan } from "./plan";
import { MaterializationApplicationError, MaterializationApplicationService, parseMaterializationRequest } from "./service";
import { ImportReviewService } from "../import/staging";
import { SQLiteImportJobRepository, SQLiteImportRecordRepository } from "../../server/import/SQLiteImportRepositories";
import { programFixture } from "../../domain/program";

beforeEach(() => {
  closeDatabase();
  process.env.PULSE_DB_PATH = ":memory:";
  process.env.PULSE_ADMIN_PASSWORD = "r10e1-admin-password";
  seedBaseline();
  seedAuthFoundation();
});

function emptyPlan(snapshotHash: string, status: MaterializationPlan["status"] = "READY"): MaterializationPlan {
  const base = {
    status, importJobId: "import-e1", approvedAnalysisRevision: 1,
    sourceSnapshot: { importJobId: "import-e1", approvedAnalysisRevision: 1, sourceSnapshotHash: snapshotHash, targetPlanYear: 1405, sourceRecordCount: 0 },
    planYear: 1405, items: [],
    summary: { goals: 0, objectives: 0, activities: 0, workItems: 0, sourceRecords: 0, blockedItems: 0 },
    errors: [], warnings: []
  };
  return { ...base, planHash: materializationPlanHash(base) };
}

function fixture(status: "APPROVED" | "REVIEW_REQUIRED" = "APPROVED") {
  const db = getDatabase();
  const source = { type: "EXCEL" as const, name: "isolated.xlsx", metadata: { planYear: 1405, classification: "CANONICAL", domain: "master-plan" } };
  db.prepare(`INSERT INTO users (id,username,password_hash,role_id) VALUES ('actor-1','actor-1','hash','role-super-admin')`).run();
  const review = new ImportReviewService(undefined, new SQLiteImportJobRepository(), new SQLiteImportRecordRepository());
  review.createJob(source, "import-e1");
  review.analyze("import-e1", programFixture);
  const approved = review.approve("import-e1");
  const snapshot = createImportSnapshotReference(approved, 1405);
  if (status !== "APPROVED") db.prepare("UPDATE import_jobs SET status=? WHERE id='import-e1'").run(status);
  applyMaterializationFoundationMigration(db);
  return { db, snapshot };
}

function body(snapshot: ReturnType<typeof createImportSnapshotReference>) {
  return {
    importJobId: "import-e1", approvedAnalysisRevision: 1, sourceSnapshotHash: snapshot.sourceSnapshotHash,
    targetPlanYear: 1405
  };
}

describe("R10-E.1 materialization application boundary", () => {
  it("defines all materialization permissions in the normal RBAC path", () => {
    expect(can("imports.materialize.request", "SUPER_ADMIN")).toBe(true);
    expect(can("imports.materialize.execute", "SUPER_ADMIN")).toBe(true);
    expect(can("imports.materialize.retry", "SUPER_ADMIN")).toBe(true);
    expect(can("imports.materialize.view", "SUPER_ADMIN")).toBe(true);
    const db = getDatabase();
    db.prepare("DELETE FROM role_permissions WHERE role_id='role-super-admin' AND permission_id=?").run("permission-imports.materialize.request");
    expect(can("imports.materialize.request", "SUPER_ADMIN")).toBe(false);
  });

  it("rejects an unapproved import, stale revision, and changed snapshot", () => {
    const unapproved = fixture("REVIEW_REQUIRED");
    const service = new MaterializationApplicationService();
    expect(() => service.request("actor-1", body(unapproved.snapshot), "import-e1")).toThrowError(MaterializationApplicationError);
    closeDatabase();
    process.env.PULSE_DB_PATH = ":memory:";
    seedBaseline(); seedAuthFoundation();
    const approved = fixture();
    expect(() => service.request("actor-1", { ...body(approved.snapshot), approvedAnalysisRevision: 2 }, "import-e1")).toThrow(/stale/i);
    expect(() => service.request("actor-1", { ...body(approved.snapshot), sourceSnapshotHash: "changed" }, "import-e1")).toThrow(/snapshot/i);
  });

  it("requires explicit pinned request fields and rejects caller-supplied plans", () => {
    expect(() => parseMaterializationRequest({}, "import-e1")).toThrow(/importJobId/);
    expect(() => parseMaterializationRequest({ importJobId: "other" }, "import-e1")).toThrow(/route import/i);
    expect(() => parseMaterializationRequest({ importJobId: "import-e1", approvedAnalysisRevision: 1, sourceSnapshotHash: "hash", targetPlanYear: 1405, plan: {} }, "import-e1")).toThrow(/server-authoritative/i);
  });

  it("reaches the existing materialization command with the authenticated actor and deduplicates", () => {
    const { snapshot, db } = fixture();
    const service = new MaterializationApplicationService();
    const first = service.request("actor-1", body(snapshot), "import-e1");
    expect(first.duplicate).toBe(false);
    expect(first.operation.actorUserId).toBe("actor-1");
    const second = service.request("actor-2", body(snapshot), "import-e1");
    expect(second.duplicate).toBe(true);
    expect(second.operation.operationId).toBe(first.operation.operationId);
    expect(db.prepare("SELECT COUNT(*) AS count FROM materialization_operations").get()).toEqual({ count: 1 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM approved_materialization_snapshots").get()).toEqual({ count: 1 });
    db.prepare("DELETE FROM import_records WHERE job_id=?").run("import-e1");
    const replayAfterSourceMutation = service.request("actor-2", body(snapshot), "import-e1");
    expect(replayAfterSourceMutation.duplicate).toBe(true);
  });

  it("rejects caller-authored plan content before executing", () => {
    const { snapshot, db } = fixture();
    expect(() => new MaterializationApplicationService().request("actor-1", { ...body(snapshot), plan: emptyPlan(snapshot.sourceSnapshotHash, "BLOCKED") }, "import-e1")).toThrow(/server-authoritative/i);
    expect(db.prepare("SELECT COUNT(*) AS count FROM materialization_operations").get()).toEqual({ count: 0 });
  });

  it("blocks malicious plan, hash-matching metadata, and responsibility tampering", () => {
    const { snapshot, db } = fixture();
    const altered = emptyPlan(snapshot.sourceSnapshotHash);
    altered.items = [{
      entityType: "action",
      logicalIdentity: { entityType: "action", logicalKey: "tampered", title: "tampered", planYear: 1405 },
      sourceRecords: [], normalizedValues: { action: "tampered" }, responsibility: [{ field: "department", resolved: true, targetType: "UNIT", targetId: "role-as-unit" }],
      ordering: { ordinal: 1, sourceSheetIndex: 0, sourceRow: 1, sourceRecordId: "tampered" }, canonicalAllocation: { ordinal: 1 }, conflictState: "NONE", provenanceReferences: []
    }];
    expect(() => new MaterializationApplicationService().request("actor-1", {
      ...body(snapshot), plan: { ...altered, planHash: emptyPlan(snapshot.sourceSnapshotHash).planHash }
    }, "import-e1")).toThrow(/server-authoritative/i);
    expect(db.prepare("SELECT COUNT(*) AS count FROM materialization_operations").get()).toEqual({ count: 0 });
  });

  it("allows retry only for FAILED operations and rejects completed operations or changed snapshots", () => {
    const { snapshot, db } = fixture();
    const repository = new SQLiteMaterializationRepository(db);
    repository.createOperation({
      operationId: "failed-e1", importJobId: "import-e1", approvedAnalysisRevision: 1,
      sourceSnapshotHash: snapshot.sourceSnapshotHash, actorUserId: "actor-1", targetPlanYear: 1405,
      requestedAt: "2026-08-26T00:00:00.000Z"
    });
    repository.transition("failed-e1", "VALIDATING");
    repository.transition("failed-e1", "READY");
    repository.transition("failed-e1", "EXECUTING");
    repository.transition("failed-e1", "FAILED", undefined, "test");
    const service = new MaterializationApplicationService();
    expect(() => service.retry("actor-1", "failed-e1", { ...body(snapshot), sourceSnapshotHash: "changed" })).toThrow(/snapshot/i);
    const retried = service.retry("actor-1", "failed-e1", body(snapshot));
    expect(retried.operation.status).toBe("COMPLETED");
    expect(() => service.retry("actor-1", "failed-e1", body(snapshot))).toThrow(/completed/i);
  });
});
