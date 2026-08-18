import type { ProgramQualityScore } from "../../../domain/program";
import type { ImportValidationResult } from "../contracts";
import type { ImportAssessmentResult, ImportJob, ImportJobStatus } from "../staging/ImportJob";

export type ImportJobRepository = {
  create(job: ImportJob): ImportJob;
  get(id: string): ImportJob | undefined;
  list(): ImportJob[];
  updateStatus(id: string, status: ImportJobStatus, approvedAt?: string): ImportJob;
  saveAnalysisResult(
    id: string,
    validationResult: ImportValidationResult,
    assessmentResult: ImportAssessmentResult,
    qualityScore: ProgramQualityScore
  ): ImportJob;
};
