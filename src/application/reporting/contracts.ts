import type {
  OrganizationalContextProvenance,
  OrganizationalContextSnapshot
} from "../organization/OrganizationalContext";
import type { SessionUser } from "../../server/auth";
import type {
  GovernedProgramEvaluationResult
} from "../program/GovernedProgramEvaluationService";
import type { GovernanceEvidence, GovernanceSubject } from "../organization/governance/OrganizationalGovernance";
import { DEFAULT_PLANNING_CONTEXT } from "../../domain/planning";

export const GOVERNED_OPERATIONAL_REPORT_VERSION = "10E.1";
export const GOVERNED_OPERATIONAL_REPORT_PLAN_YEAR = DEFAULT_PLANNING_CONTEXT.planYear;

export type GovernedOperationalReportFilters = {
  goalId?: string;
  status?: string;
  assignmentId?: string;
};

export type GovernedOperationalReportInput = {
  governedEvaluation: GovernedProgramEvaluationResult;
  organizationalContext: OrganizationalContextSnapshot;
  authorization: Pick<SessionUser, "id" | "scope" | "person_id" | "department_id">;
  filters?: GovernedOperationalReportFilters;
  legacyCompatibilityMetrics?: LegacyCompatibilityMetric[];
  generatedAt: string;
  planYear?: number;
};

export type GovernedFindingView = {
  ruleId: string;
  severity: "INFO" | "WARNING" | "BLOCKER" | "error" | "warning";
  subject: GovernanceSubject;
  reason: string;
  evidence?: GovernanceEvidence;
  provenance: OrganizationalContextProvenance[];
  planYear: number;
};

export type LegacyCompatibilityMetric = {
  name: string;
  value: number | string;
  source: string;
  compatibilityStatus: "LEGACY_NON_GOVERNED";
  governed: false;
};

export type GovernedOperationalReportRow = {
  id: string;
  title: string;
  type: "activity" | "action";
  status: string;
  progress: number;
  goalId?: string;
  parentId?: string;
  eligibleAssignmentIds: string[];
};

export type GovernedOperationalReport = {
  reportId: "governed-operational-report";
  reportVersion: typeof GOVERNED_OPERATIONAL_REPORT_VERSION;
  program: {
    id: string;
    title: string;
    status: string;
  };
  planYear: number;
  generatedAt: string;
  evaluationState: "PASS" | "WARNING" | "BLOCKED";
  authorization: {
    userId: string;
    scope: SessionUser["scope"];
    personId?: string;
    departmentId?: string;
    subjectVisible: boolean;
  };
  summary: {
    goals: number;
    objectives: number;
    activities: number;
    actions: number;
    eligibleAssignments: number;
    governedFindings: number;
    qualityScore: number;
  };
  rows: GovernedOperationalReportRow[];
  eligibleAssignmentIds: string[];
  findings: GovernedFindingView[];
  qualityScore: GovernedProgramEvaluationResult["qualityScore"];
  provenance: OrganizationalContextProvenance[];
  historicalEvidence: OrganizationalContextSnapshot["context"]["historicalEvidence"];
  unresolvedReferences: OrganizationalContextSnapshot["context"]["unresolvedReferences"];
  legacyCompatibilityMetrics: LegacyCompatibilityMetric[];
};
