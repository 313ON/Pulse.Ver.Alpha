import type { Activity, Action, Program } from "../../domain/program";
import type { GovernanceFinding } from "../organization/governance/OrganizationalGovernance";
import type { GovernanceValidationReport } from "../../domain/program/governance/GovernanceViolation";
import type { ResponsibilityAssessmentFinding } from "../../domain/program/governance/ResponsibilityAssessment";
import type { ProgramQualityFinding } from "../../domain/program/quality/ProgramQualityScore";
import type {
  GovernedOperationalReport,
  GovernedOperationalReportInput,
  GovernedFindingView
} from "./contracts";
import {
  GOVERNED_OPERATIONAL_REPORT_PLAN_YEAR,
  GOVERNED_OPERATIONAL_REPORT_VERSION
} from "./contracts";
import type { OrganizationalContextProvenance } from "../organization/OrganizationalContext";

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function provenanceKey(value: OrganizationalContextProvenance): string {
  const reference = value.reference;
  return stableJson([
    value.kind,
    value.sourceOnly,
    reference.workbook,
    reference.sheet,
    reference.row,
    reference.column,
    reference.cell,
    reference.sourceYear
  ]);
}

function stableProvenance(
  values: readonly OrganizationalContextProvenance[]
): OrganizationalContextProvenance[] {
  return [...new Map(values.map((value) => [provenanceKey(value), value])).values()]
    .sort((left, right) => provenanceKey(left).localeCompare(provenanceKey(right)));
}

function findingKey(value: GovernedFindingView): string {
  return stableJson([
    value.ruleId,
    value.severity,
    value.subject.type,
    value.subject.id ?? "",
    value.reason,
    value.evidence
  ]);
}

function fromOrganizationalFinding(
  input: GovernedOperationalReportInput,
  finding: GovernanceFinding
): GovernedFindingView {
  return {
    ruleId: finding.ruleId,
    severity: finding.severity,
    subject: finding.subject,
    reason: finding.reason,
    evidence: finding.evidence,
    provenance: stableProvenance(input.organizationalContext.context.provenance),
    planYear: input.planYear ?? GOVERNED_OPERATIONAL_REPORT_PLAN_YEAR
  };
}

function fromProgramViolation(
  input: GovernedOperationalReportInput,
  violation: GovernanceValidationReport["violations"][number]
): GovernedFindingView {
  return {
    ruleId: violation.rule,
    severity: violation.severity,
    subject: {
      type: violation.entityType.toUpperCase() as GovernedFindingView["subject"]["type"],
      id: violation.entityId
    },
    reason: violation.message,
    provenance: stableProvenance(input.organizationalContext.context.provenance),
    planYear: input.planYear ?? GOVERNED_OPERATIONAL_REPORT_PLAN_YEAR
  };
}

function fromAssessmentFinding(
  input: GovernedOperationalReportInput,
  finding: ResponsibilityAssessmentFinding
): GovernedFindingView {
  return {
    ruleId: finding.code,
    severity: finding.severity,
    subject: { type: finding.entityType.toUpperCase() as GovernedFindingView["subject"]["type"], id: finding.entityId },
    reason: finding.message,
    provenance: stableProvenance(input.organizationalContext.context.provenance),
    planYear: input.planYear ?? GOVERNED_OPERATIONAL_REPORT_PLAN_YEAR
  };
}

function fromQualityFinding(
  input: GovernedOperationalReportInput,
  finding: ProgramQualityFinding
): GovernedFindingView {
  return {
    ruleId: finding.code,
    severity: finding.severity,
    subject: { type: "PROGRAM_ENTITY", id: finding.entityId },
    reason: finding.message,
    provenance: stableProvenance(input.organizationalContext.context.provenance),
    planYear: input.planYear ?? GOVERNED_OPERATIONAL_REPORT_PLAN_YEAR
  };
}

function entities(program: Program): Array<Activity | Action> {
  return program.goals.flatMap((goal) => goal.objectives.flatMap((objective) =>
    objective.activities.flatMap((activity) => [activity, ...activity.actions])
  ));
}

function goalIdForEntity(program: Program, entityId: string): string | undefined {
  return program.goals.find((goal) => goal.objectives.some((objective) =>
    objective.activities.some((activity) =>
      activity.id === entityId || activity.actions.some((action) => action.id === entityId)
    )
  ))?.id;
}

function visibleToReport(
  input: GovernedOperationalReportInput,
  entity: Activity | Action
): boolean {
  if (!input.organizationalContext.context.authorizationScope.subjectVisible) return false;
  if (input.authorization.scope === "COMPANY") return true;
  return entity.assignments.some((assignment) =>
    input.governedEvaluation.eligibleAssignmentIds.has(assignment.id)
  );
}

function makeRows(input: GovernedOperationalReportInput): GovernedOperationalReport["rows"] {
  const filters = input.filters ?? {};
  const program = input.governedEvaluation.program.program;
  return entities(input.governedEvaluation.program.program)
    .filter((entity) => visibleToReport(input, entity))
    .filter((entity) => !filters.goalId || goalIdForEntity(program, entity.id) === filters.goalId)
    .filter((entity) => !filters.status || entity.status === filters.status)
    .filter((entity) => !filters.assignmentId || entity.assignments.some((assignment) => assignment.id === filters.assignmentId))
    .map((entity) => ({
      id: entity.id,
      title: entity.title,
      type: entity.type,
      status: entity.status,
      progress: entity.progress,
      goalId: goalIdForEntity(program, entity.id),
      parentId: entity.type === "activity" ? entity.objectiveId : entity.activityId,
      eligibleAssignmentIds: entity.assignments
        .filter((assignment) => input.governedEvaluation.eligibleAssignmentIds.has(assignment.id))
        .map((assignment) => assignment.id)
        .sort((left, right) => left.localeCompare(right))
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function reportState(input: GovernedOperationalReportInput): GovernedOperationalReport["evaluationState"] {
  if (input.governedEvaluation.evaluationState === "BLOCKED"
    || input.governedEvaluation.governance.errors.length > 0) {
    return "BLOCKED";
  }
  if (input.governedEvaluation.evaluationState === "WARNING"
    || input.governedEvaluation.governance.warnings.length > 0
    || input.governedEvaluation.assessment.some((finding) => finding.severity === "warning")
    || input.governedEvaluation.qualityScore.findings.some((finding) => finding.severity === "warning")) {
    return "WARNING";
  }
  return "PASS";
}

export class GovernedOperationalReportAdapter {
  project(input: GovernedOperationalReportInput): GovernedOperationalReport {
    if (!input.generatedAt.trim()) {
      throw new Error("Governed operational reports require an explicit generatedAt value.");
    }

    const organizationalFindings = input.governedEvaluation.organizationalGovernance.findings
      .map((finding) => fromOrganizationalFinding(input, finding));
    const programFindings = input.governedEvaluation.governance.violations
      .map((finding) => fromProgramViolation(input, finding));
    const assessmentFindings = input.governedEvaluation.assessment
      .map((finding) => fromAssessmentFinding(input, finding));
    const qualityFindings = input.governedEvaluation.qualityScore.findings
      .map((finding) => fromQualityFinding(input, finding));
    const findings = [...organizationalFindings, ...programFindings, ...assessmentFindings, ...qualityFindings];
    const stableFindings = [...new Map(findings.map((finding) => [findingKey(finding), finding])).values()]
      .sort((left, right) =>
        left.ruleId.localeCompare(right.ruleId)
        || left.subject.type.localeCompare(right.subject.type)
        || (left.subject.id ?? "").localeCompare(right.subject.id ?? "")
        || left.reason.localeCompare(right.reason)
      );
    const rows = makeRows(input);
    const eligibleAssignmentIds = [...input.governedEvaluation.eligibleAssignmentIds].sort((left, right) => left.localeCompare(right));
    const program = input.governedEvaluation.program.program;
    const objectives = program.goals.flatMap((goal) => goal.objectives);
    const activities = objectives.flatMap((objective) => objective.activities);
    const actions = activities.flatMap((activity) => activity.actions);
    const provenance = stableProvenance([
      ...input.organizationalContext.context.provenance,
      ...stableFindings.flatMap((finding) => finding.provenance)
    ]);

    return structuredClone({
      reportId: "governed-operational-report",
      reportVersion: GOVERNED_OPERATIONAL_REPORT_VERSION,
      program: { id: program.id, title: program.title, status: program.status },
      planYear: input.planYear ?? GOVERNED_OPERATIONAL_REPORT_PLAN_YEAR,
      generatedAt: input.generatedAt,
      evaluationState: reportState(input),
      authorization: {
        userId: input.authorization.id,
        scope: input.authorization.scope,
        personId: input.authorization.person_id,
        departmentId: input.authorization.department_id,
        subjectVisible: input.organizationalContext.context.authorizationScope.subjectVisible
      },
      summary: {
        goals: program.goals.length,
        objectives: objectives.length,
        activities: activities.length,
        actions: actions.length,
        eligibleAssignments: eligibleAssignmentIds.length,
        governedFindings: stableFindings.length,
        qualityScore: input.governedEvaluation.qualityScore.overallScore
      },
      rows,
      eligibleAssignmentIds,
      findings: stableFindings,
      qualityScore: input.governedEvaluation.qualityScore,
      provenance,
      historicalEvidence: input.organizationalContext.context.historicalEvidence,
      unresolvedReferences: input.organizationalContext.context.unresolvedReferences,
      legacyCompatibilityMetrics: [...(input.legacyCompatibilityMetrics ?? [])]
    });
  }
}
