import type Database from "better-sqlite3";
import type { MaterializableEntityType, ProvenanceRelation } from "../../application/materialization/contracts";
import {
  assertLegalMaterializationTransition,
  type MaterializationCounts,
  type MaterializationMapping,
  type MaterializationOperation,
  type MaterializationOperationInput,
  type MaterializationRepository,
  type MaterializationStatus
} from "../../application/materialization/persistence";

type OperationRow = Record<string, unknown>;
type MappingRow = Record<string, unknown>;
type ProvenanceRow = Record<string, unknown>;

const now = () => new Date().toISOString();

function counts(row: OperationRow): MaterializationCounts {
  return {
    goals: Number(row.goal_count),
    objectives: Number(row.objective_count),
    activities: Number(row.activity_count),
    workItems: Number(row.work_item_count),
    provenance: Number(row.provenance_count),
    goalsReused: Number(row.goal_reused_count ?? 0),
    objectivesReused: Number(row.objective_reused_count ?? 0),
    activitiesReused: Number(row.activity_reused_count ?? 0),
    workItemsReused: Number(row.work_item_reused_count ?? 0)
  };
}

function operation(row: OperationRow): MaterializationOperation {
  return {
    operationId: String(row.operation_id),
    importJobId: String(row.import_job_id),
    approvedAnalysisRevision: Number(row.approved_analysis_revision),
    sourceSnapshotHash: String(row.source_snapshot_hash),
    actorUserId: String(row.actor_user_id),
    targetPlanYear: Number(row.target_plan_year),
    status: String(row.status) as MaterializationStatus,
    requestedAt: String(row.requested_at),
    startedAt: row.started_at ? String(row.started_at) : undefined,
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    failureReason: row.failure_reason ? String(row.failure_reason) : undefined,
    counts: counts(row),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapping(row: MappingRow): MaterializationMapping {
  return {
    operationId: String(row.operation_id),
    importJobId: String(row.import_job_id),
    sourceRecordId: String(row.source_record_id),
    canonicalEntityType: String(row.canonical_entity_type) as MaterializableEntityType,
    canonicalEntityId: String(row.canonical_entity_id),
    logicalIdentityKey: String(row.logical_identity_key),
    mappingStatus: String(row.mapping_status) as "CREATED" | "REUSED",
    createdAt: row.created_at ? String(row.created_at) : undefined
  };
}

function provenance(row: ProvenanceRow): ProvenanceRelation & { provenanceId: string } {
  return {
    provenanceId: String(row.provenance_id),
    relation: String(row.relation_type) as ProvenanceRelation["relation"],
    importJobId: String(row.import_job_id),
    sourceRecordId: String(row.source_record_id),
    canonicalEntityType: String(row.canonical_entity_type) as MaterializableEntityType,
    canonicalEntityId: String(row.canonical_entity_id),
    source: row.provenance_json ? JSON.parse(String(row.provenance_json)) : undefined
  };
}

export class SQLiteMaterializationRepository implements MaterializationRepository {
  constructor(private readonly database: Database.Database) {}

  createOperation(input: MaterializationOperationInput) {
    const timestamp = now();
    const existing = this.findByIdempotencyKey(input);
    if (existing) return { operation: existing };
    this.database.prepare(`
      INSERT INTO materialization_operations
      (operation_id, import_job_id, approved_analysis_revision, source_snapshot_hash,
       actor_user_id, target_plan_year, status, requested_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'REQUESTED', ?, ?, ?)
    `).run(
      input.operationId, input.importJobId, input.approvedAnalysisRevision,
      input.sourceSnapshotHash, input.actorUserId, input.targetPlanYear,
      input.requestedAt, timestamp, timestamp
    );
    return { operation: this.require(input.operationId) };
  }

  findByIdempotencyKey(input: Pick<MaterializationOperationInput, "importJobId" | "approvedAnalysisRevision" | "sourceSnapshotHash">) {
    const row = this.database.prepare(`
      SELECT * FROM materialization_operations
      WHERE import_job_id = ? AND approved_analysis_revision = ? AND source_snapshot_hash = ?
    `).get(input.importJobId, input.approvedAnalysisRevision, input.sourceSnapshotHash) as OperationRow | undefined;
    return row ? operation(row) : undefined;
  }

  getOperation(operationId: string) {
    const row = this.database.prepare("SELECT * FROM materialization_operations WHERE operation_id = ?").get(operationId) as OperationRow | undefined;
    return row ? operation(row) : undefined;
  }

  listOperationsByImport(importJobId: string) {
    return (this.database.prepare(`
      SELECT * FROM materialization_operations WHERE import_job_id = ?
      ORDER BY created_at, operation_id
    `).all(importJobId) as OperationRow[]).map(operation);
  }

  transition(operationId: string, to: MaterializationStatus, at = now(), failureReason?: string) {
    const current = this.require(operationId);
    assertLegalMaterializationTransition(current.status, to);
    const startedAt = to === "EXECUTING" ? at : current.startedAt ?? null;
    const completedAt = ["COMPLETED", "REJECTED", "FAILED"].includes(to) ? at : current.completedAt ?? null;
    this.database.prepare(`
      UPDATE materialization_operations
      SET status = ?, started_at = ?, completed_at = ?, failure_reason = ?, updated_at = ?
      WHERE operation_id = ?
    `).run(to, startedAt, completedAt, failureReason ?? current.failureReason ?? null, at, operationId);
    return this.require(operationId);
  }

  updateTerminal(operationId: string, status: "COMPLETED" | "FAILED" | "REJECTED", value: MaterializationCounts, failureReason?: string, at = now()) {
    const current = this.require(operationId);
    if (current.status !== "EXECUTING" && current.status !== "VALIDATING") {
      throw new Error(`Terminal result requires EXECUTING or VALIDATING state, got ${current.status}.`);
    }
    const completed = this.transition(operationId, status, at, failureReason);
    this.database.prepare(`
      UPDATE materialization_operations
      SET goal_count = ?, objective_count = ?, activity_count = ?, work_item_count = ?, provenance_count = ?,
          goal_reused_count = ?, objective_reused_count = ?, activity_reused_count = ?, work_item_reused_count = ?, updated_at = ?
      WHERE operation_id = ?
    `).run(value.goals, value.objectives, value.activities, value.workItems, value.provenance,
      value.goalsReused, value.objectivesReused, value.activitiesReused, value.workItemsReused, at, operationId);
    return this.require(completed.operationId);
  }

  recordMapping(value: MaterializationMapping) {
    const createdAt = value.createdAt ?? now();
    this.database.prepare(`
      INSERT INTO materialization_entity_map
      (operation_id, import_job_id, source_record_id, canonical_entity_type,
       canonical_entity_id, logical_identity_key, mapping_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      value.operationId, value.importJobId, value.sourceRecordId,
      value.canonicalEntityType, value.canonicalEntityId,
      value.logicalIdentityKey, value.mappingStatus, createdAt
    );
    return { ...value, createdAt };
  }

  listMappingsBySource(importJobId: string, sourceRecordId: string) {
    return (this.database.prepare(`
      SELECT * FROM materialization_entity_map
      WHERE import_job_id = ? AND source_record_id = ?
      ORDER BY canonical_entity_type, canonical_entity_id
    `).all(importJobId, sourceRecordId) as MappingRow[]).map(mapping);
  }

  listMappingsByCanonical(entityType: MaterializableEntityType, canonicalEntityId: string) {
    return (this.database.prepare(`
      SELECT * FROM materialization_entity_map
      WHERE canonical_entity_type = ? AND canonical_entity_id = ?
      ORDER BY import_job_id, source_record_id
    `).all(entityType, canonicalEntityId) as MappingRow[]).map(mapping);
  }

  recordProvenance(value: ProvenanceRelation & {
    provenanceId: string;
    sourceWorkbook: string;
    sourceSheet?: string;
    sourceRow?: number;
    sourceCell?: string;
    semanticType?: string;
    operationId: string;
    provenanceJson: string;
  }) {
    this.database.prepare(`
      INSERT INTO canonical_provenance
      (provenance_id, canonical_entity_type, canonical_entity_id, import_job_id,
       source_record_id, source_workbook, source_sheet, source_row, source_cell,
       semantic_type, provenance_json, first_created_operation_id, relation_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      value.provenanceId, value.canonicalEntityType, value.canonicalEntityId,
      value.importJobId, value.sourceRecordId, value.sourceWorkbook,
      value.sourceSheet ?? null, value.sourceRow ?? null, value.sourceCell ?? null,
      value.semanticType ?? null, value.provenanceJson, value.operationId, value.relation
    );
  }

  listProvenanceBySource(importJobId: string, sourceRecordId: string) {
    return (this.database.prepare(`
      SELECT * FROM canonical_provenance
      WHERE import_job_id = ? AND source_record_id = ?
      ORDER BY created_at, provenance_id
    `).all(importJobId, sourceRecordId) as ProvenanceRow[]).map(provenance);
  }

  listProvenanceByCanonical(entityType: MaterializableEntityType, canonicalEntityId: string) {
    return (this.database.prepare(`
      SELECT * FROM canonical_provenance
      WHERE canonical_entity_type = ? AND canonical_entity_id = ?
      ORDER BY created_at, provenance_id
    `).all(entityType, canonicalEntityId) as ProvenanceRow[]).map(provenance);
  }

  private require(operationId: string) {
    const value = this.getOperation(operationId);
    if (!value) throw new Error(`Materialization operation "${operationId}" was not found.`);
    return value;
  }
}
