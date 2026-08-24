import type { ProgramQualityScore } from "../../../domain/program";
import type { Program } from "../../../domain/program";
import type { ImportValidationResult } from "../contracts";
import type { ImportAnalysisRevision, ImportAssessmentResult, ImportJob, ImportJobStatus, ImportRemediationRecord } from "../staging/ImportJob";
import type { ImportJobRepository } from "../ports";
import type { SpreadsheetEvaluationReport } from "../spreadsheet/evaluation/contracts";

export class InMemoryImportJobRepository implements ImportJobRepository {
  private readonly jobs = new Map<string, ImportJob>();
  private readonly revisions = new Map<string, ImportAnalysisRevision[]>();
  private readonly remediations = new Map<string, ImportRemediationRecord>();

  create(job: ImportJob): ImportJob {
    if (this.jobs.has(job.id)) throw new Error(`Import job "${job.id}" already exists.`);
    this.jobs.set(job.id, job);
    return job;
  }

  get(id: string): ImportJob | undefined {
    return this.jobs.get(id);
  }

  list(): ImportJob[] {
    return [...this.jobs.values()];
  }

  updateStatus(id: string, status: ImportJobStatus, approvedAt?: string, expectedAnalysisRevision?: number): ImportJob {
    const job = this.require(id);
    if (expectedAnalysisRevision !== undefined && (job.analysisRevision ?? 0) !== expectedAnalysisRevision) {
      throw new Error("The import review has changed. Reload the latest findings.");
    }
    job.status = status;
    if (approvedAt) job.approvedAt = approvedAt;
    return job;
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
    const job = this.require(id);
    if (expectedAnalysisRevision !== undefined && (job.analysisRevision ?? 0) !== expectedAnalysisRevision) {
      throw new Error("The import review has changed. Reload the latest findings.");
    }
    const revision = (job.analysisRevision ?? 0) + 1;
    if (!job.analysisBaseline && analysisBaseline) job.analysisBaseline = structuredClone(analysisBaseline);
    job.validationResult = validationResult;
    if (evaluationResult !== undefined) job.evaluationResult = evaluationResult;
    job.assessmentResult = assessmentResult;
    job.qualityScore = qualityScore;
    job.analysisRevision = revision;
    const history = this.revisions.get(id) ?? [];
    history.push({
      id: `analysis-${id}-${revision}`,
      importJobId: id,
      revision,
      validationResult,
      evaluationResult: evaluationResult ?? job.evaluationResult,
      assessmentResult,
      qualityScore,
      triggeringRemediationId,
      status: "COMPLETED",
      createdAt: new Date().toISOString()
    });
    this.revisions.set(id, history);
    return job;
  }

  getAnalysisRevisions(id: string): ImportAnalysisRevision[] {
    return [...(this.revisions.get(id) ?? [])];
  }

  getCurrentAnalysisRevision(id: string): ImportAnalysisRevision | undefined {
    const revisions = this.revisions.get(id) ?? [];
    return revisions[revisions.length - 1];
  }

  createRemediation(record: ImportRemediationRecord): ImportRemediationRecord {
    this.remediations.set(record.id, record);
    return record;
  }

  listRemediations(id: string): ImportRemediationRecord[] {
    return [...this.remediations.values()].filter((record) => record.importJobId === id);
  }

  getRemediation(id: string): ImportRemediationRecord | undefined {
    return this.remediations.get(id);
  }

  saveFailure(id: string, reason: string): ImportJob {
    const job = this.require(id);
    job.status = "FAILED";
    job.failureReason = reason;
    return job;
  }

  private require(id: string): ImportJob {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Import job "${id}" was not found.`);
    return job;
  }
}
