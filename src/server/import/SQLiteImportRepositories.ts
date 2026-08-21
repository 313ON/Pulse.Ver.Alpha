import type { ProgramQualityScore } from "../../domain/program";
import type { ImportValidationResult, ImportRecord } from "../../application/import/contracts";
import type { ImportAssessmentResult, ImportJob, ImportJobStatus } from "../../application/import/staging/ImportJob";
import type { ImportJobRepository } from "../../application/import/ports/ImportJobRepository";
import type { ImportRecordRepository } from "../../application/import/ports/ImportRecordRepository";
import { getDatabase } from "../db";

export class SQLiteImportJobRepository implements ImportJobRepository {
  create(job: ImportJob): ImportJob {
    getDatabase().prepare(`
      INSERT INTO import_jobs (id, source_json, status, validation_json, assessment_json, quality_score_json, created_at, approved_at, failure_reason)
      VALUES (@id, @source, @status, @validation, @assessment, @quality, @createdAt, @approvedAt, @failureReason)
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
      assessmentResult: row.assessment_json ? JSON.parse(String(row.assessment_json)) : undefined,
      qualityScore: row.quality_score_json ? JSON.parse(String(row.quality_score_json)) : undefined,
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

  updateStatus(id: string, status: ImportJobStatus, approvedAt?: string): ImportJob {
    getDatabase().prepare("UPDATE import_jobs SET status = ?, approved_at = COALESCE(?, approved_at) WHERE id = ?").run(status, approvedAt ?? null, id);
    return this.require(id);
  }

  saveAnalysisResult(id: string, validationResult: ImportValidationResult, assessmentResult: ImportAssessmentResult, qualityScore: ProgramQualityScore): ImportJob {
    getDatabase().prepare(`
      UPDATE import_jobs SET validation_json = ?, assessment_json = ?, quality_score_json = ?, failure_reason = NULL
      WHERE id = ?
    `).run(JSON.stringify(validationResult), JSON.stringify(assessmentResult), JSON.stringify(qualityScore), id);
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
}

export class SQLiteImportRecordRepository implements ImportRecordRepository {
  attach(jobId: string, records: ImportRecord[]): ImportRecord[] {
    const database = getDatabase();
    database.prepare("DELETE FROM import_records WHERE job_id = ?").run(jobId);
    const insert = database.prepare("INSERT INTO import_records (id, job_id, record_json) VALUES (?, ?, ?)");
    for (const record of records) insert.run(record.id, jobId, JSON.stringify(record));
    return records;
  }

  getByJobId(jobId: string): ImportRecord[] {
    return (getDatabase().prepare("SELECT record_json FROM import_records WHERE job_id = ? ORDER BY id").all(jobId) as Array<{ record_json: string }>)
      .map((row) => JSON.parse(row.record_json) as ImportRecord);
  }
}
