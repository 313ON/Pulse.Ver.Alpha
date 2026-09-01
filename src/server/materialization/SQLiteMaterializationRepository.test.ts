import { afterEach, beforeEach, describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { closeDatabase, getDatabase } from "../db";
import { applyMaterializationFoundationMigration } from "./migration";
import { SQLiteMaterializationRepository } from "./SQLiteMaterializationRepository";

let databasePath = "";

beforeEach(() => {
  closeDatabase();
  databasePath = path.join(os.tmpdir(), `pulse-materialization-${Date.now()}-${Math.random()}.sqlite`);
  process.env.PULSE_DB_PATH = databasePath;
});

afterEach(() => {
  closeDatabase();
});

function fixture() {
  const database = getDatabase();
  database.exec(`
    INSERT INTO app_roles (id, code, title) VALUES ('role-test', 'TEST', 'Test');
    INSERT INTO users (id, username, password_hash, role_id, active) VALUES ('user-test', 'materializer', 'hash', 'role-test', 1);
    INSERT INTO import_jobs (id, source_json, status, created_at, analysis_revision)
    VALUES ('import-test', '{}', 'APPROVED', '2026-08-26T00:00:00.000Z', 1);
  `);
  applyMaterializationFoundationMigration(database);
  return { database, repository: new SQLiteMaterializationRepository(database) };
}

const input = {
  operationId: "operation-1",
  importJobId: "import-test",
  approvedAnalysisRevision: 1,
  sourceSnapshotHash: "hash-1",
  actorUserId: "user-test",
  targetPlanYear: 1405,
  requestedAt: "2026-08-26T00:01:00.000Z"
};

describe("R10-B materialization persistence", () => {
  it("applies safely to a fresh schema without changing canonical or import rows", () => {
    const { database } = fixture();
    expect(database.prepare("SELECT COUNT(*) AS count FROM strategic_goals").get()).toEqual({ count: 0 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM sub_goals").get()).toEqual({ count: 0 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM activities").get()).toEqual({ count: 0 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM work_items").get()).toEqual({ count: 0 });
    expect(database.prepare("SELECT status FROM import_jobs WHERE id = 'import-test'").get()).toEqual({ status: "APPROVED" });
  });

  it("resolves duplicate requests through the unique idempotency key", () => {
    const { repository, database } = fixture();
    const first = repository.createOperation(input).operation;
    const second = repository.createOperation({ ...input, operationId: "operation-2" }).operation;
    expect(second.operationId).toBe(first.operationId);
    expect(database.prepare("SELECT COUNT(*) AS count FROM materialization_operations").get()).toEqual({ count: 1 });
  });

  it("enforces the operation state machine and terminal behavior", () => {
    const { repository } = fixture();
    repository.createOperation(input);
    expect(repository.transition(input.operationId, "VALIDATING").status).toBe("VALIDATING");
    expect(repository.transition(input.operationId, "READY").status).toBe("READY");
    expect(repository.transition(input.operationId, "EXECUTING").status).toBe("EXECUTING");
    expect(repository.updateTerminal(input.operationId, "COMPLETED", {
      goals: 1, objectives: 2, activities: 3, workItems: 4, provenance: 5,
      goalsReused: 0, objectivesReused: 0, activitiesReused: 0, workItemsReused: 0
    }).counts).toMatchObject({ goals: 1, objectives: 2, activities: 3, workItems: 4, provenance: 5 });
    expect(() => repository.transition(input.operationId, "FAILED")).toThrow(/Illegal materialization transition/);
  });

  it("supports explicit retry only from FAILED", () => {
    const { repository } = fixture();
    repository.createOperation(input);
    repository.transition(input.operationId, "VALIDATING");
    repository.transition(input.operationId, "READY");
    repository.transition(input.operationId, "EXECUTING");
    repository.transition(input.operationId, "FAILED", undefined, "test failure");
    expect(repository.transition(input.operationId, "REQUESTED").status).toBe("REQUESTED");
  });

  it("rejects illegal transitions and duplicate terminal writes", () => {
    const { repository } = fixture();
    repository.createOperation(input);
    expect(() => repository.transition(input.operationId, "EXECUTING")).toThrow(/Illegal materialization transition/);
    repository.transition(input.operationId, "VALIDATING");
    repository.transition(input.operationId, "REJECTED");
    expect(() => repository.transition(input.operationId, "REQUESTED")).toThrow(/Illegal materialization transition/);
  });

  it("persists mappings with bidirectional source and canonical lookup", () => {
    const { repository } = fixture();
    repository.createOperation(input);
    repository.recordMapping({
      operationId: input.operationId,
      importJobId: input.importJobId,
      sourceRecordId: "source-1",
      canonicalEntityType: "objective",
      canonicalEntityId: "objective-1",
      logicalIdentityKey: "objective|1405|goal|objective",
      mappingStatus: "CREATED"
    });
    expect(repository.listMappingsBySource("import-test", "source-1")).toHaveLength(1);
    expect(repository.listMappingsByCanonical("objective", "objective-1")).toHaveLength(1);
    expect(() => repository.recordMapping({
      operationId: input.operationId,
      importJobId: input.importJobId,
      sourceRecordId: "source-1",
      canonicalEntityType: "objective",
      canonicalEntityId: "objective-1",
      logicalIdentityKey: "objective|1405|goal|objective",
      mappingStatus: "CREATED"
    })).toThrow();
  });

  it("persists append-only provenance and supports both lookup directions", () => {
    const { repository, database } = fixture();
    repository.createOperation(input);
    repository.recordProvenance({
      provenanceId: "provenance-1",
      relation: "CREATED_FROM",
      importJobId: "import-test",
      sourceRecordId: "source-1",
      canonicalEntityType: "objective",
      canonicalEntityId: "objective-1",
      operationId: input.operationId,
      sourceWorkbook: "workbook.xlsx",
      sourceSheet: "Sheet1",
      sourceRow: 4,
      sourceCell: "D4",
      semanticType: "OBJECTIVE",
      provenanceJson: JSON.stringify([{ address: "D4" }])
    });
    expect(repository.listProvenanceBySource("import-test", "source-1")).toHaveLength(1);
    expect(repository.listProvenanceByCanonical("objective", "objective-1")).toHaveLength(1);
    expect(() => database.prepare("DELETE FROM canonical_provenance WHERE provenance_id = 'provenance-1'").run())
      .toThrow(/append-only/);
    expect(() => database.prepare("UPDATE canonical_provenance SET relation_type = 'REUSED_FROM' WHERE provenance_id = 'provenance-1'").run())
      .toThrow(/append-only/);
  });

  it("rolls back the opt-in migration transaction on failure", () => {
    const { database } = fixture();
    expect(() => database.transaction(() => {
      database.exec("CREATE TABLE migration_rollback_probe (id TEXT)");
      throw new Error("forced rollback");
    })()).toThrow("forced rollback");
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migration_rollback_probe'").get()).toBeUndefined();
  });

  it("is safe to apply the foundation migration repeatedly", () => {
    const { database } = fixture();
    expect(() => applyMaterializationFoundationMigration(database)).not.toThrow();
    expect(database.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('materialization_operations', 'materialization_entity_map', 'canonical_provenance')").get())
      .toEqual({ count: 3 });
  });
});
