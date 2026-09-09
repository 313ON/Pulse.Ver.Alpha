import { randomUUID } from "node:crypto";
import type { MaterializationPlan } from "./plan";
import { buildMaterializationPlan, materializationPlanHash } from "./plan";
import { createImportSnapshotReference } from "./snapshot";
import type { MaterializationOperation } from "./persistence";
import { SQLiteMaterializationRepository } from "../../server/materialization/SQLiteMaterializationRepository";
import { applyMaterializationFoundationMigration } from "../../server/materialization/migration";
import { SQLiteCanonicalMaterializationWriter } from "./writer";
import { SQLiteImportJobRepository, SQLiteImportRecordRepository } from "../../server/import/SQLiteImportRepositories";
import { getDatabase } from "../../server/db";
import { RepositoryError } from "../../server/repositories";

export class MaterializationApplicationError extends Error {
  constructor(
    public readonly code:
      | "IMPORT_NOT_APPROVED"
      | "REVISION_MISMATCH"
      | "SNAPSHOT_MISMATCH"
      | "INVALID_OPERATION_STATE"
      | "MATERIALIZATION_CONFLICT"
      | "VALIDATION",
    message: string
  ) {
    super(message);
  }
}

export type MaterializationHttpInput = {
  importJobId: string;
  approvedAnalysisRevision: number;
  sourceSnapshotHash: string;
  targetPlanYear: number;
};

export type MaterializationReadiness = {
  importJobId: string;
  status: "READY" | "BLOCKED";
  targetPlanYear: number;
  snapshot?: ReturnType<typeof createImportSnapshotReference>;
  plan?: MaterializationPlan;
  blockers: Array<{ code: string; message: string; entityType?: string; identityKey?: string; recordIds?: string[] }>;
  operations: MaterializationOperation[];
};

export type MaterializationAuditEvent = {
  id: string;
  actorUserId?: string;
  entityType: string;
  entityId: string;
  eventType: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
};

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new MaterializationApplicationError("VALIDATION", `${field} is required.`);
  return value;
}

function inputFromBody(body: Record<string, unknown>, routeImportId?: string): MaterializationHttpInput {
  const importJobId = requiredString(body.importJobId, "importJobId");
  if (routeImportId && routeImportId !== importJobId) throw new MaterializationApplicationError("VALIDATION", "The route import ID does not match the request.");
  const approvedAnalysisRevision = Number(body.approvedAnalysisRevision);
  const targetPlanYear = Number(body.targetPlanYear);
  if (!Number.isInteger(approvedAnalysisRevision) || approvedAnalysisRevision < 1) {
    throw new MaterializationApplicationError("VALIDATION", "approvedAnalysisRevision must be a positive integer.");
  }
  if (!Number.isInteger(targetPlanYear) || targetPlanYear < 1) {
    throw new MaterializationApplicationError("VALIDATION", "targetPlanYear must be a positive integer.");
  }
  if (Object.prototype.hasOwnProperty.call(body, "plan")) {
    throw new MaterializationApplicationError("VALIDATION", "Materialization plan content is server-authoritative and must not be supplied.");
  }
  return {
    importJobId,
    approvedAnalysisRevision,
    sourceSnapshotHash: requiredString(body.sourceSnapshotHash, "sourceSnapshotHash"),
    targetPlanYear
  };
}

function assertSnapshot(input: MaterializationHttpInput) {
  const jobs = new SQLiteImportJobRepository();
  const records = new SQLiteImportRecordRepository();
  const job = jobs.get(input.importJobId);
  if (!job) throw new RepositoryError("NOT_FOUND", "The import job was not found.");
  job.records = records.getByJobId(input.importJobId);
  if (job.status !== "APPROVED") throw new MaterializationApplicationError("IMPORT_NOT_APPROVED", "The import must be approved before materialization.");
  if (job.analysisRevision !== input.approvedAnalysisRevision) throw new MaterializationApplicationError("REVISION_MISMATCH", "The approved analysis revision is stale.");
  const snapshot = createImportSnapshotReference(job, input.targetPlanYear);
  if (snapshot.sourceSnapshotHash !== input.sourceSnapshotHash) throw new MaterializationApplicationError("SNAPSHOT_MISMATCH", "The source snapshot no longer matches the approved import.");
  return { job, snapshot };
}

function authoritativePlan(input: MaterializationHttpInput, operationId?: string): MaterializationPlan {
  const database = getDatabase();
  applyMaterializationFoundationMigration(database);
  const approvedRow = database.prepare(`
    SELECT plan_hash, payload_json
    FROM approved_materialization_snapshots
    WHERE import_job_id = ? AND approved_analysis_revision = ? AND source_snapshot_hash = ?
  `).get(input.importJobId, input.approvedAnalysisRevision, input.sourceSnapshotHash) as { plan_hash: string; payload_json: string } | undefined;
  if (approvedRow) {
    const status = database.prepare("SELECT status FROM import_jobs WHERE id = ?").get(input.importJobId) as { status: string } | undefined;
    if (status?.status !== "APPROVED") throw new MaterializationApplicationError("IMPORT_NOT_APPROVED", "The import must be approved before materialization.");
    let plan: MaterializationPlan;
    try { plan = JSON.parse(approvedRow.payload_json) as MaterializationPlan; } catch { throw new MaterializationApplicationError("SNAPSHOT_MISMATCH", "The approved materialization snapshot is invalid."); }
    assertAuthoritativePlan(input, plan);
    if (plan.planHash !== approvedRow.plan_hash) throw new MaterializationApplicationError("SNAPSHOT_MISMATCH", "The approved materialization snapshot failed its integrity check.");
    return plan;
  }
  const { job, snapshot } = assertSnapshot(input);
  if (operationId) {
    const persisted = repository().repository.getSnapshot(operationId);
    if (persisted?.status === "RECONSTRUCTABLE" && persisted.plan) {
      if (persisted.importJobId !== input.importJobId ||
          persisted.approvedAnalysisRevision !== input.approvedAnalysisRevision ||
          persisted.sourceSnapshotHash !== input.sourceSnapshotHash) {
        throw new MaterializationApplicationError("SNAPSHOT_MISMATCH", "The persisted materialization snapshot does not match the request.");
      }
      return persisted.plan;
    }
  }
  const plan = buildMaterializationPlan({ importJob: job, snapshot, request: input, planYear: input.targetPlanYear });
  database.prepare(`
    INSERT OR IGNORE INTO approved_materialization_snapshots
      (import_job_id, approved_analysis_revision, source_snapshot_hash, plan_hash, payload_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(input.importJobId, input.approvedAnalysisRevision, input.sourceSnapshotHash, plan.planHash, JSON.stringify(plan));
  return plan;
}

function assertAuthoritativePlan(input: MaterializationHttpInput, plan: MaterializationPlan): void {
  if (plan.importJobId !== input.importJobId ||
      plan.approvedAnalysisRevision !== input.approvedAnalysisRevision ||
      plan.sourceSnapshot.sourceSnapshotHash !== input.sourceSnapshotHash ||
      plan.planYear !== input.targetPlanYear) {
    throw new MaterializationApplicationError("SNAPSHOT_MISMATCH", "The server-derived materialization plan is stale or mismatched.");
  }
  const { planHash, ...withoutHash } = plan;
  if (materializationPlanHash(withoutHash) !== planHash) {
    throw new MaterializationApplicationError("SNAPSHOT_MISMATCH", "The server-derived materialization plan failed its integrity check.");
  }
}

function repository() {
  const database = getDatabase();
  applyMaterializationFoundationMigration(database);
  return { database, repository: new SQLiteMaterializationRepository(database) };
}

export class MaterializationApplicationService {
  readiness(importJobId: string, targetPlanYear: number): MaterializationReadiness {
    const jobs = new SQLiteImportJobRepository();
    const records = new SQLiteImportRecordRepository();
    const job = jobs.get(importJobId);
    if (!job) throw new RepositoryError("NOT_FOUND", "The import job was not found.");
    job.records = records.getByJobId(importJobId);
    const operations = repository().repository.listOperationsByImport(importJobId);
    if (job.status !== "APPROVED") {
      return {
        importJobId,
        status: "BLOCKED",
        targetPlanYear,
        blockers: [{ code: "NOT_APPROVED", message: "The import must be approved before materialization readiness can be evaluated." }],
        operations
      };
    }
    try {
      const snapshot = createImportSnapshotReference(job, targetPlanYear);
      const request = {
        importJobId,
        approvedAnalysisRevision: snapshot.approvedAnalysisRevision,
        sourceSnapshotHash: snapshot.sourceSnapshotHash,
        targetPlanYear
      };
      const plan = buildMaterializationPlan({ importJob: job, snapshot, request, planYear: targetPlanYear });
      const blockers = plan.errors.map(({ code, message, entityType, identityKey, recordIds }) => ({ code, message, entityType, identityKey, recordIds }));
      return { importJobId, status: blockers.length ? "BLOCKED" : "READY", targetPlanYear, snapshot, plan, blockers, operations };
    } catch (error) {
      return {
        importJobId,
        status: "BLOCKED",
        targetPlanYear,
        blockers: [{ code: "INVALID_SOURCE", message: error instanceof Error ? error.message : "Unable to evaluate materialization readiness." }],
        operations
      };
    }
  }

  audit(importJobId: string): MaterializationAuditEvent[] {
    const { database } = repository();
    const rows = database.prepare(`
      SELECT id, actor_user_id, entity_type, entity_id, event_type, before_json, after_json, created_at
      FROM audit_log
      WHERE (entity_type = 'materialization' AND entity_id IN (
        SELECT operation_id FROM materialization_operations WHERE import_job_id = ?
      )) OR (entity_type = 'import-review' AND entity_id = ?)
      ORDER BY created_at, id
    `).all(importJobId, importJobId) as Array<Record<string, unknown>>;
    const parse = (value: unknown) => {
      if (!value) return undefined;
      try { return JSON.parse(String(value)); } catch { return undefined; }
    };
    return rows.map((row) => ({
      id: String(row.id),
      actorUserId: row.actor_user_id ? String(row.actor_user_id) : undefined,
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      eventType: String(row.event_type),
      before: parse(row.before_json),
      after: parse(row.after_json),
      createdAt: String(row.created_at)
    }));
  }

  request(actorUserId: string, body: Record<string, unknown>, routeImportId: string): { operation: MaterializationOperation; duplicate: boolean } {
    const input = inputFromBody(body, routeImportId);
    const plan = authoritativePlan(input);
    assertAuthoritativePlan(input, plan);
    const { repository: materializationRepository } = repository();
    const existing = materializationRepository.findByIdempotencyKey(input);
    if (existing) return { operation: existing, duplicate: true };
    const operationId = typeof body.operationId === "string" && body.operationId.trim() ? body.operationId : `materialization-${randomUUID()}`;
    const created = materializationRepository.createOperation({
      operationId, importJobId: input.importJobId, approvedAnalysisRevision: input.approvedAnalysisRevision,
      sourceSnapshotHash: input.sourceSnapshotHash, actorUserId, targetPlanYear: input.targetPlanYear,
      requestedAt: new Date().toISOString()
    });
    if (created.operation.operationId !== operationId) return { operation: created.operation, duplicate: true };
    materializationRepository.transition(created.operation.operationId, "VALIDATING");
    if (plan.status !== "READY" || plan.errors.length || plan.summary.blockedItems > 0) {
      materializationRepository.transition(created.operation.operationId, "REJECTED", undefined, "The supplied materialization plan is not READY.");
      throw new MaterializationApplicationError("VALIDATION", "The supplied materialization plan is not READY.");
    }
    materializationRepository.transition(created.operation.operationId, "READY");
    const result = new SQLiteCanonicalMaterializationWriter(getDatabase()).execute({
      operationId: created.operation.operationId, importJobId: input.importJobId, approvedAnalysisRevision: input.approvedAnalysisRevision,
      sourceSnapshotHash: input.sourceSnapshotHash, planHash: plan.planHash,
      actorUserId, targetPlanYear: input.targetPlanYear, plan
    });
    return { operation: result.operation, duplicate: false };
  }

  retry(actorUserId: string, operationId: string, body: Record<string, unknown>): { operation: MaterializationOperation; duplicate: boolean } {
    const input = inputFromBody(body);
    const plan = authoritativePlan(input, operationId);
    assertAuthoritativePlan(input, plan);
    const { repository: materializationRepository } = repository();
    const current = materializationRepository.getOperation(operationId);
    if (!current) throw new RepositoryError("NOT_FOUND", "The materialization operation was not found.");
    if (current.status === "COMPLETED") throw new MaterializationApplicationError("INVALID_OPERATION_STATE", "A completed materialization cannot be retried.");
    if (current.status !== "FAILED") throw new MaterializationApplicationError("INVALID_OPERATION_STATE", "Only FAILED materializations can be retried.");
    if (current.importJobId !== input.importJobId || current.approvedAnalysisRevision !== input.approvedAnalysisRevision ||
        current.sourceSnapshotHash !== input.sourceSnapshotHash || current.targetPlanYear !== input.targetPlanYear) {
      throw new MaterializationApplicationError("SNAPSHOT_MISMATCH", "The retry snapshot does not match the failed operation.");
    }
    materializationRepository.transition(operationId, "REQUESTED");
    materializationRepository.transition(operationId, "VALIDATING");
    if (plan.status !== "READY" || plan.errors.length || plan.summary.blockedItems > 0) {
      materializationRepository.transition(operationId, "REJECTED", undefined, "The supplied materialization plan is not READY.");
      throw new MaterializationApplicationError("VALIDATION", "The supplied materialization plan is not READY.");
    }
    materializationRepository.transition(operationId, "READY");
    const result = new SQLiteCanonicalMaterializationWriter(getDatabase()).execute({
      operationId, importJobId: input.importJobId, approvedAnalysisRevision: input.approvedAnalysisRevision,
      sourceSnapshotHash: input.sourceSnapshotHash, planHash: plan.planHash,
      actorUserId, targetPlanYear: input.targetPlanYear, plan
    });
    return { operation: result.operation, duplicate: false };
  }

  list(importJobId: string): MaterializationOperation[] {
    return repository().repository.listOperationsByImport(importJobId);
  }

  get(operationId: string): MaterializationOperation {
    const result = repository().repository.getOperation(operationId);
    if (!result) throw new RepositoryError("NOT_FOUND", "The materialization operation was not found.");
    return result;
  }

  reconstruct(operationId: string) {
    return repository().repository.getSnapshot(operationId);
  }
}

export function parseMaterializationRequest(body: Record<string, unknown>, routeImportId?: string): MaterializationHttpInput {
  return inputFromBody(body, routeImportId);
}
