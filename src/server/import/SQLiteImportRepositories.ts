import type { ProgramQualityScore } from "../../domain/program";
import type { ImportValidationResult, ImportRecord } from "../../application/import/contracts";
import type { ImportAssessmentResult, ImportJob, ImportJobStatus } from "../../application/import/staging/ImportJob";
import type { ImportJobRepository } from "../../application/import/ports/ImportJobRepository";
import type { ImportRecordRepository } from "../../application/import/ports/ImportRecordRepository";
import type { SpreadsheetEvaluationReport } from "../../application/import/spreadsheet/evaluation/contracts";
import { getDatabase } from "../db";
import { RepositoryError } from "../repositories";
import { randomUUID } from "node:crypto";
import type { ImportAnalysisRevision, ImportRemediationRecord } from "../../application/import/staging/ImportJob";
import type { Program } from "../../domain/program";

function parseEvaluationResult(value: unknown): SpreadsheetEvaluationReport | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  try {
    return JSON.parse(String(value)) as SpreadsheetEvaluationReport;
  } catch {
    throw new RepositoryError("DATABASE", "Persisted import evaluation is malformed.");
  }
}

export class SQLiteImportJobRepository implements ImportJobRepository {
  create(job: ImportJob): ImportJob {
    getDatabase().prepare(`
      INSERT INTO import_jobs (id, source_json, status, validation_json, assessment_json, quality_score_json, created_at, approved_at, failure_reason, analysis_revision)
      VALUES (@id, @source, @status, @validation, @assessment, @quality, @createdAt, @approvedAt, @failureReason, 0)
    `).run({
      id: job.id,
      source: JSON.stringify(job.source),
      status: job.status,
      validation: null,
      assessment: null,
      quality: null,
      createdAt: job.createdAt,
      approvedAt: null,
      failureReason: null
    });
    return job;
  }

  get(id: string): ImportJob | undefined {
    const row = getDatabase().prepare("SELECT * FROM import_jobs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      id: String(row.id),
      source: JSON.parse(String(row.source_json)),
      status: String(row.status) as ImportJobStatus,
      records: [],
      validationResult: row.validation_json ? JSON.parse(String(row.validation_json)) : undefined,
      evaluationResult: parseEvaluationResult(row.evaluation_json),
      assessmentResult: row.assessment_json ? JSON.parse(String(row.assessment_json)) : undefined,
      qualityScore: row.quality_score_json ? JSON.parse(String(row.quality_score_json)) : undefined,
      analysisBaseline: row.baseline_program_json ? JSON.parse(String(row.baseline_program_json)) as Program : undefined,
      analysisRevision: Number(row.analysis_revision ?? 0),
      createdAt: String(row.created_at),
      approvedAt: row.approved_at ? String(row.approved_at) : undefined,
      failureReason: row.failure_reason ? String(row.failure_reason) : undefined
    };
  }

  list(): ImportJob[] {
    return (getDatabase().prepare("SELECT id FROM import_jobs ORDER BY created_at DESC").all() as Array<{ id: string }>)
      .map((row) => this.get(row.id))
      .filter((job): job is ImportJob => Boolean(job));
  }

  updateStatus(id: string, status: ImportJobStatus, approvedAt?: string, expectedAnalysisRevision?: number): ImportJob {
    const result = getDatabase().prepare(`
      UPDATE import_jobs
      SET status = ?, approved_at = COALESCE(?, approved_at)
      WHERE id = ? AND (? IS NULL OR analysis_revision = ?)
    `).run(status, approvedAt ?? null, id, expectedAnalysisRevision ?? null, expectedAnalysisRevision ?? null);
    if (result.changes === 0) {
      if (expectedAnalysisRevision !== undefined) {
        throw new Error("The import review has changed. Reload the latest findings.");
      }
      throw new RepositoryError("NOT_FOUND", `Import job "${id}" was not found.`);
    }
    return this.require(id);
  }

  saveAnalysisResult(
    id: string,
    validationResult: ImportValidationResult,
    assessmentResult: ImportAssessmentResult,
    qualityScore: ProgramQualityScore,
    evaluationResult?: SpreadsheetEvaluationReport,
    triggeringRemediationId?: string,
    expectedAnalysisRevision?: number,
    analysisBaseline?: Program
  ): ImportJob {
    const database = getDatabase();
    const current = database.prepare("SELECT analysis_revision FROM import_jobs WHERE id = ?").get(id) as { analysis_revision?: number } | undefined;
    if (!current) throw new RepositoryError("NOT_FOUND", "The import job was not found.");
    const currentRevision = Number(current.analysis_revision ?? 0);
    if (expectedAnalysisRevision !== undefined && currentRevision !== expectedAnalysisRevision) {
      throw new Error("The import review has changed. Reload the latest findings.");
    }
    const revision = currentRevision + 1;
    const persistedEvaluation = evaluationResult === undefined
      ? (database.prepare("SELECT evaluation_json FROM import_jobs WHERE id = ?").get(id) as { evaluation_json?: string } | undefined)?.evaluation_json ?? null
      : JSON.stringify(evaluationResult);
    database.transaction(() => {
      const update = database.prepare(`
        UPDATE import_jobs SET validation_json = ?, evaluation_json = COALESCE(?, evaluation_json), assessment_json = ?, quality_score_json = ?, failure_reason = NULL, analysis_revision = ?, baseline_program_json = COALESCE(baseline_program_json, ?)
        WHERE id = ? AND (? IS NULL OR analysis_revision = ?)
      `).run(
        JSON.stringify(validationResult),
        evaluationResult === undefined ? null : JSON.stringify(evaluationResult),
        JSON.stringify(assessmentResult),
        JSON.stringify(qualityScore),
        revision,
        analysisBaseline ? JSON.stringify(analysisBaseline) : null,
        id,
        expectedAnalysisRevision ?? null,
        expectedAnalysisRevision ?? null
      );
      if (update.changes !== 1) {
        throw new Error("The import review has changed. Reload the latest findings.");
      }
      database.prepare(`
        INSERT INTO import_analysis_revisions
        (id, import_job_id, revision, validation_json, evaluation_json, assessment_json, quality_score_json, triggering_remediation_id, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)
      `).run(
        randomUUID(), id, revision, JSON.stringify(validationResult),
        persistedEvaluation, JSON.stringify(assessmentResult), JSON.stringify(qualityScore), triggeringRemediationId ?? null, new Date().toISOString()
      );
    })();
    return this.require(id);
  }

  saveFailure(id: string, reason: string): ImportJob {
    getDatabase().prepare("UPDATE import_jobs SET status = 'FAILED', failure_reason = ? WHERE id = ?").run(reason, id);
    return this.require(id);
  }

  private require(id: string): ImportJob {
    const job = this.get(id);
    if (!job) throw new Error(`Import job "${id}" was not found.`);
    return job;
  }

  getAnalysisRevisions(id: string): ImportAnalysisRevision[] {
    return (getDatabase().prepare("SELECT * FROM import_analysis_revisions WHERE import_job_id = ? ORDER BY revision").all(id) as Array<Record<string, unknown>>)
      .map((row) => ({
        id: String(row.id),
        importJobId: String(row.import_job_id),
        revision: Number(row.revision),
        validationResult: JSON.parse(String(row.validation_json)),
        evaluationResult: parseEvaluationResult(row.evaluation_json),
        assessmentResult: JSON.parse(String(row.assessment_json)),
        qualityScore: JSON.parse(String(row.quality_score_json)),
        triggeringRemediationId: row.triggering_remediation_id ? String(row.triggering_remediation_id) : undefined,
        status: String(row.status) as "COMPLETED" | "FAILED",
        createdAt: String(row.created_at)
      }));
  }

  getCurrentAnalysisRevision(id: string): ImportAnalysisRevision | undefined {
    const revisions = this.getAnalysisRevisions(id);
    return revisions[revisions.length - 1];
  }

  createRemediation(record: ImportRemediationRecord): ImportRemediationRecord {
    try {
      getDatabase().prepare(`
        INSERT INTO import_remediations
        (id, import_job_id, rule, target_entity_type, target_entity_id, old_effective_owner,
         proposed_owner_id, owner_display_name, reason, source_finding_json, source_provenance_json,
         actor_user_id, expected_analysis_revision, status, resulting_analysis_revision,
         supersedes_remediation_id, created_at)
        VALUES (@id, @importJobId, @rule, @targetEntityType, @targetEntityId, @oldEffectiveOwner,
         @proposedOwnerId, @ownerDisplayName, @reason, @sourceFinding, @sourceProvenance,
         @actorUserId, @expectedAnalysisRevision, @status, @resultingAnalysisRevision,
         @supersedesRemediationId, @createdAt)
      `).run({
        ...record,
        sourceFinding: JSON.stringify(record.sourceFinding),
        sourceProvenance: record.sourceProvenance ? JSON.stringify(record.sourceProvenance) : null,
        resultingAnalysisRevision: record.resultingAnalysisRevision ?? null,
        supersedesRemediationId: record.supersedesRemediationId ?? null
      });
      return record;
    } catch (error) {
      throw new RepositoryError("DATABASE", error instanceof Error ? error.message : "The remediation could not be persisted.");
    }
  }

  listRemediations(id: string): ImportRemediationRecord[] {
    return (getDatabase().prepare("SELECT * FROM import_remediations WHERE import_job_id = ? ORDER BY created_at").all(id) as Array<Record<string, unknown>>)
      .map((row) => this.mapRemediation(row));
  }

  getRemediation(id: string): ImportRemediationRecord | undefined {
    const row = getDatabase().prepare("SELECT * FROM import_remediations WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? this.mapRemediation(row) : undefined;
  }

  private mapRemediation(row: Record<string, unknown>): ImportRemediationRecord {
    return {
      id: String(row.id),
      importJobId: String(row.import_job_id),
      rule: String(row.rule) as "goal.owner.required",
      targetEntityType: String(row.target_entity_type) as "goal",
      targetEntityId: String(row.target_entity_id),
      oldEffectiveOwner: row.old_effective_owner ? String(row.old_effective_owner) : undefined,
      proposedOwnerId: String(row.proposed_owner_id),
      ownerDisplayName: String(row.owner_display_name),
      reason: String(row.reason),
      sourceFinding: JSON.parse(String(row.source_finding_json)),
      sourceProvenance: row.source_provenance_json ? JSON.parse(String(row.source_provenance_json)) : undefined,
      actorUserId: String(row.actor_user_id),
      expectedAnalysisRevision: Number(row.expected_analysis_revision),
      status: String(row.status) as "APPLIED" | "REJECTED",
      resultingAnalysisRevision: row.resulting_analysis_revision == null ? undefined : Number(row.resulting_analysis_revision),
      supersedesRemediationId: row.supersedes_remediation_id ? String(row.supersedes_remediation_id) : undefined,
      createdAt: String(row.created_at)
    };
  }
}

export class SQLiteImportRecordRepository implements ImportRecordRepository {
  attach(jobId: string, records: ImportRecord[]): ImportRecord[] {
    const database = getDatabase();
    const replaceRecords = database.transaction(() => {
      database.prepare("DELETE FROM import_records WHERE job_id = ?").run(jobId);
      const insert = database.prepare("INSERT INTO import_records (id, job_id, record_json) VALUES (?, ?, ?)");
      for (const record of records) insert.run(record.id, jobId, JSON.stringify(record));
    });
    replaceRecords();
    return records;
  }

  getByJobId(jobId: string): ImportRecord[] {
    return (getDatabase().prepare("SELECT record_json FROM import_records WHERE job_id = ? ORDER BY id").all(jobId) as Array<{ record_json: string }>)
      .map((row) => JSON.parse(row.record_json) as ImportRecord);
  }
}
