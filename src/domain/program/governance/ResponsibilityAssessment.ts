import type { Assignment } from "../Assignment";
import type { Activity, Action, Program } from "../types";

export type ResponsibilityAssessmentCode =
  | "ACTIVITY_WITHOUT_RESPONSIBLE_EXECUTOR"
  | "OVER_DEPENDENT_INDIVIDUAL"
  | "OVERLOADED_UNIT"
  | "MISSING_COLLABORATION_COVERAGE";

export type ResponsibilityAssessmentFinding = {
  code: ResponsibilityAssessmentCode;
  entityId: string;
  entityType: "activity" | "action" | "PERSON" | "UNIT";
  message: string;
  severity: "warning" | "error";
  assignmentCount?: number;
  threshold?: number;
};

export type ResponsibilityAssessmentOptions = {
  individualAssignmentThreshold?: number;
  unitAssignmentThreshold?: number;
  requireCriticalCollaboration?: boolean;
};

const isResponsibleExecutor = (assignment: Assignment) =>
  assignment.responsibilityType === "PRIMARY"
  && (assignment.role === "EXECUTOR" || assignment.role === "OWNER");

export function assessProgramResponsibilities(
  program: Program,
  options: ResponsibilityAssessmentOptions = {}
): ResponsibilityAssessmentFinding[] {
  const individualThreshold = options.individualAssignmentThreshold ?? 5;
  const unitThreshold = options.unitAssignmentThreshold ?? 10;
  const requireCriticalCollaboration = options.requireCriticalCollaboration ?? true;
  const activities: Activity[] = program.goals.flatMap((goal) => goal.objectives.flatMap((objective) => objective.activities));
  const actions: Action[] = activities.flatMap((activity) => activity.actions);
  const findings: ResponsibilityAssessmentFinding[] = [];
  const personCounts = new Map<string, number>();
  const unitCounts = new Map<string, number>();

  for (const entity of [...activities, ...actions]) {
    const assignments = entity.assignments ?? [];
    if (entity.type === "activity" && !assignments.some(isResponsibleExecutor)) {
      findings.push({
        code: "ACTIVITY_WITHOUT_RESPONSIBLE_EXECUTOR",
        entityId: entity.id,
        entityType: "activity",
        severity: "error",
        message: "Activity has no primary responsible executor."
      });
    }
    if (requireCriticalCollaboration && entity.priority === "بحرانی" && !assignments.some((assignment) => assignment.role === "COLLABORATOR")) {
      findings.push({
        code: "MISSING_COLLABORATION_COVERAGE",
        entityId: entity.id,
        entityType: entity.type,
        severity: "warning",
        message: `${entity.type} has no collaboration coverage.`
      });
    }
    for (const assignment of assignments) {
      const counts = assignment.entityType === "PERSON" ? personCounts : unitCounts;
      counts.set(assignment.entityId, (counts.get(assignment.entityId) ?? 0) + 1);
    }
  }

  for (const [entityId, assignmentCount] of personCounts) {
    if (assignmentCount > individualThreshold) {
      findings.push({
        code: "OVER_DEPENDENT_INDIVIDUAL",
        entityId,
        entityType: "PERSON",
        severity: "warning",
        assignmentCount,
        threshold: individualThreshold,
        message: `Individual has ${assignmentCount} assignments, exceeding the threshold of ${individualThreshold}.`
      });
    }
  }
  for (const [entityId, assignmentCount] of unitCounts) {
    if (assignmentCount > unitThreshold) {
      findings.push({
        code: "OVERLOADED_UNIT",
        entityId,
        entityType: "UNIT",
        severity: "warning",
        assignmentCount,
        threshold: unitThreshold,
        message: `Organizational unit has ${assignmentCount} assignments, exceeding the threshold of ${unitThreshold}.`
      });
    }
  }
  return findings;
}
