import type { ProgramQualityScore } from "../../../domain/program";
import type { ImportValidationResult } from "../contracts";
import type { ImportAssessmentResult, ImportJob, ImportJobStatus } from "../staging/ImportJob";
import type { ImportJobRepository } from "../ports";

export class InMemoryImportJobRepository implements ImportJobRepository {
  private readonly jobs = new Map<string, ImportJob>();

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

  updateStatus(id: string, status: ImportJobStatus, approvedAt?: string): ImportJob {
    const job = this.require(id);
    job.status = status;
    if (approvedAt) job.approvedAt = approvedAt;
    return job;
  }

  saveAnalysisResult(
    id: string,
    validationResult: ImportValidationResult,
    assessmentResult: ImportAssessmentResult,
    qualityScore: ProgramQualityScore
  ): ImportJob {
    const job = this.require(id);
    job.validationResult = validationResult;
    job.assessmentResult = assessmentResult;
    job.qualityScore = qualityScore;
    return job;
  }

  private require(id: string): ImportJob {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Import job "${id}" was not found.`);
    return job;
  }
}
