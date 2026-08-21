import type {
  ImportRecord,
  ImportSource,
  ImportValidationResult
} from "../contracts";
import type { GovernanceValidationReport, ResponsibilityAssessmentFinding } from "../../../domain/program";
import type { ProgramQualityScore } from "../../../domain/program";

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
  assessmentResult?: ImportAssessmentResult;
  qualityScore?: ProgramQualityScore;
  createdAt: string;
  approvedAt?: string;
  failureReason?: string;
};
