import type {
  ImportRecord,
  ImportSource,
  ImportValidationResult
} from "../contracts";
import type { GovernanceValidationReport, ResponsibilityAssessmentFinding } from "../../../domain/program";
import type { ProgramQualityScore } from "../../../domain/program";
import type { Program } from "../../../domain/program";
import type { SpreadsheetEvaluationReport } from "../spreadsheet/evaluation/contracts";

export type ImportJobStatus =
  | "DRAFT"
  | "ANALYZING"
  | "REVIEW_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "FAILED";

export type ImportAssessmentResult = {
  governance: GovernanceValidationReport;
  findings: ResponsibilityAssessmentFinding[];
};

export type ImportJob = {
  id: string;
  source: ImportSource;
  status: ImportJobStatus;
  records: ImportRecord[];
  validationResult?: ImportValidationResult;
  evaluationResult?: SpreadsheetEvaluationReport;
  assessmentResult?: ImportAssessmentResult;
  qualityScore?: ProgramQualityScore;
  analysisBaseline?: Program;
  analysisRevision?: number;
  analysisRevisions?: ImportAnalysisRevision[];
  remediations?: ImportRemediationRecord[];
  createdAt: string;
  approvedAt?: string;
  failureReason?: string;
};

export type ImportAnalysisRevision = {
  id: string;
  importJobId: string;
  revision: number;
  validationResult: ImportValidationResult;
  evaluationResult?: SpreadsheetEvaluationReport;
  assessmentResult: ImportAssessmentResult;
  qualityScore: ProgramQualityScore;
  triggeringRemediationId?: string;
  status: "COMPLETED" | "FAILED";
  createdAt: string;
};

export type ImportRemediationRecord = {
  id: string;
  importJobId: string;
  rule: "goal.owner.required";
  targetEntityType: "goal";
  targetEntityId: string;
  oldEffectiveOwner?: string;
  proposedOwnerId: string;
  ownerDisplayName: string;
  reason: string;
  sourceFinding: Record<string, unknown>;
  sourceProvenance?: Record<string, unknown>;
  actorUserId: string;
  expectedAnalysisRevision: number;
  status: "APPLIED" | "REJECTED";
  resultingAnalysisRevision?: number;
  supersedesRemediationId?: string;
  createdAt: string;
};
