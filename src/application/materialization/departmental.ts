import { randomUUID } from "node:crypto";
import { getDatabase } from "../../server/db";
import { can } from "../../server/auth";
import { SQLiteImportJobRepository, SQLiteImportRecordRepository } from "../../server/import/SQLiteImportRepositories";
import { createImportSnapshotReference, sourceWorkbookFingerprint } from "./snapshot";
import type { ImportRecord } from "../import/contracts";

export type DepartmentalMaterializationResult = {
  operationId: string;
  duplicate: boolean;
  recordCount: number;
  provenanceCount: number;
  sourceFingerprint: string;
};

function classification(jobSource: { metadata: Record<string, unknown> }): string {
  const value = jobSource.metadata.classification;
  return typeof value === "string" ? value : "";
}

function isNonCanonical(value: string): boolean {
  return ["DERIVED", "SUPPORTING", "REFERENCE", "AMBIGUOUS", "UNRESOLVED"].includes(value);
}

export class DepartmentalMaterializationService {
  materialize(actorUserId: string, importJobId: string, targetPlanYear: number): DepartmentalMaterializationResult {
    if (!actorUserId.trim()) throw new Error("An actor user ID is required.");
    const actor = getDatabase().prepare("SELECT id, role_id FROM users WHERE id = ? AND active = 1").get(actorUserId) as { id: string; role_id: string } | undefined;
    if (!actor) throw new Error("The materialization actor was not found or is inactive.");
    const role = getDatabase().prepare("SELECT code FROM app_roles WHERE id = ? AND active = 1").get(actor.role_id) as { code: string } | undefined;
    if (!role || !can("imports.materialize.execute", role.code)) throw new Error("The materialization actor is not authorized.");
    const jobs = new SQLiteImportJobRepository();
    const recordsRepository = new SQLiteImportRecordRepository();
    const job = jobs.get(importJobId);
    if (!job) throw new Error(`Import job "${importJobId}" was not found.`);
    job.records = recordsRepository.getByJobId(importJobId);
    if (job.status !== "APPROVED") throw new Error("The import must be APPROVED before departmental materialization.");
    const sourceClass = classification(job.source);
    if (!isNonCanonical(sourceClass)) throw new Error("Only explicitly non-canonical departmental/supporting imports may use this materializer.");
    const snapshot = createImportSnapshotReference(job, targetPlanYear);
    const sourceFingerprint = sourceWorkbookFingerprint(job.source, job.records);
    const db = getDatabase();
    const existing = db.prepare(`
      SELECT operation_id, record_count, provenance_count
      FROM departmental_materialization_operations
      WHERE import_job_id=? AND approved_analysis_revision=? AND source_snapshot_hash=?
    `).get(importJobId, snapshot.approvedAnalysisRevision, snapshot.sourceSnapshotHash) as { operation_id: string; record_count: number; provenance_count: number } | undefined;
    if (existing) return {
      operationId: existing.operation_id,
      duplicate: true,
      recordCount: existing.record_count,
      provenanceCount: existing.provenance_count,
      sourceFingerprint
    };
    const operationId = `departmental-materialization-${randomUUID()}`;
    const records = job.records.filter((record): record is ImportRecord & { entityType: "goal" | "objective" | "activity" | "action" } =>
      ["goal", "objective", "activity", "action"].includes(record.entityType)
    );
    for (const record of records) {
      const provenance = record.provenance ?? [];
      if (provenance.length === 0 || provenance.some((point) =>
        typeof point.sheetName !== "string" || !point.sheetName.trim() ||
        !Number.isInteger(point.sourceRowNumber) || point.sourceRowNumber < 1 ||
        typeof point.column !== "string" || !point.column.trim() ||
        typeof point.address !== "string" || !point.address.trim()
      )) {
        throw new Error(`Record "${record.id}" is missing complete source provenance.`);
      }
    }
    const sourceDuplicate = db.prepare(`
      SELECT operation_id, import_job_id, record_count, provenance_count
      FROM departmental_materialization_operations
      WHERE source_fingerprint = ?
    `).get(sourceFingerprint) as { operation_id: string; import_job_id: string; record_count: number; provenance_count: number } | undefined;
    if (sourceDuplicate && sourceDuplicate.import_job_id !== importJobId) {
      throw new Error(`The source workbook has already been materialized by import job "${sourceDuplicate.import_job_id}".`);
    }
    const insertOperation = db.prepare(`
      INSERT INTO departmental_materialization_operations
      (operation_id, import_job_id, approved_analysis_revision, source_snapshot_hash, source_fingerprint, actor_user_id, target_plan_year, status, record_count, provenance_count, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `);
    const insertRecord = db.prepare(`
      INSERT INTO departmental_planning_records
      (id, operation_id, import_job_id, source_record_id, classification, domain, entity_type,
       normalized_data_json, raw_record_json, source_workbook, source_sheet, source_row, source_cell, provenance_json, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const now = new Date().toISOString();
    const run = db.transaction(() => {
      let provenanceCount = 0;
      insertOperation.run(operationId, importJobId, snapshot.approvedAnalysisRevision, snapshot.sourceSnapshotHash, sourceFingerprint,
        actorUserId, targetPlanYear, "COMPLETED", records.length, records.reduce((sum, record) => sum + (record.provenance?.length ?? 0), 0), now);
      for (const record of records) {
        const provenance = record.provenance ?? [];
        provenanceCount += provenance.length;
        insertRecord.run(
          `departmental-record-${importJobId}-${record.id}`,
          operationId,
          importJobId,
          record.id,
          sourceClass,
          String(job.source.metadata.domain ?? ""),
          record.entityType,
          JSON.stringify(record.data),
          JSON.stringify(record),
          record.source.name,
          provenance[0]?.sheetName ?? record.source.metadata.sheetName ?? null,
          record.rowNumber ?? provenance[0]?.sourceRowNumber ?? null,
          provenance[0]?.address ?? null,
          JSON.stringify(provenance),
          now
        );
      }
      db.prepare(`INSERT INTO audit_log
        (id, actor_user_id, entity_type, entity_id, event_type, before_json, after_json)
        VALUES (?,?,?,?,?,?,?)`).run(
        randomUUID(), actorUserId, "departmental-materialization", operationId,
        "departmental_materialization_completed", null,
        JSON.stringify({ importJobId, targetPlanYear, recordCount: records.length, provenanceCount })
      );
      return provenanceCount;
    });
    return { operationId, duplicate: false, recordCount: records.length, provenanceCount: run(), sourceFingerprint };
  }
}
