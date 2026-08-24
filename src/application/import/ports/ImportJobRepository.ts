import type { ProgramQualityScore } from "../../../domain/program";
import type { Program } from "../../../domain/program";
import type { ImportValidationResult } from "../contracts";
import type { ImportAnalysisRevision, ImportAssessmentResult, ImportJob, ImportJobStatus, ImportRemediationRecord } from "../staging/ImportJob";
import type { SpreadsheetEvaluationReport } from "../spreadsheet/evaluation/contracts";

export type ImportJobRepository = {
  create(job: ImportJob): ImportJob;
  get(id: string): ImportJob | undefined;
  list(): ImportJob[];
  updateStatus(id: string, status: ImportJobStatus, approvedAt?: string, expectedAnalysisRevision?: number): ImportJob;
  saveAnalysisResult(
    id: string,
    validationResult: ImportValidationResult,
    assessmentResult: ImportAssessmentResult,
    qualityScore: ProgramQualityScore,
    evaluationResult?: SpreadsheetEvaluationReport,
    triggeringRemediationId?: string,
    expectedAnalysisRevision?: number,
    analysisBaseline?: Program
  ): ImportJob;
  saveFailure(id: string, reason: string): ImportJob;
  getAnalysisRevisions(id: string): ImportAnalysisRevision[];
  getCurrentAnalysisRevision(id: string): ImportAnalysisRevision | undefined;
  createRemediation(record: ImportRemediationRecord): ImportRemediationRecord;
  listRemediations(id: string): ImportRemediationRecord[];
  getRemediation(id: string): ImportRemediationRecord | undefined;
};
