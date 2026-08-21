import type { Program, Activity, Action } from "../../../domain/program/types";
import {
  evaluateOrganizationalGovernance,
  currentPlanYear,
  type OrganizationalGovernanceInput,
  type GovernanceResult
} from "./OrganizationalGovernance";

export type GovernedProgramProjection = {
  program: Program;
  governance: GovernanceResult;
  eligibleAssignmentIds: ReadonlySet<string>;
};

function entities(program: Program): Array<Activity | Action> {
  return program.goals.flatMap((goal) => goal.objectives.flatMap((objective) =>
    objective.activities.flatMap((activity) => [activity, ...activity.actions])
  ));
}

/**
 * Read-only 10C boundary for downstream responsibility and quality consumers.
 * It clones the program and removes only assignments blocked by 10C; the input
 * program and governance inputs are never mutated or persisted.
 */
export function projectProgramThroughOrganizationalGovernance(
  program: Program,
  input: Omit<OrganizationalGovernanceInput, "assignments">
): GovernedProgramProjection {
  const assignments = entities(program).flatMap((entity) =>
    (entity.assignments ?? []).map((assignment) => ({
      ...assignment,
      programEntityId: entity.id,
      planYear: currentPlanYear()
    }))
  );
  const governance = evaluateOrganizationalGovernance({ ...input, assignments });
  const blocked = new Set<string>();
  const hasAggregateBlocker = governance.findings.some((finding) =>
    finding.severity === "BLOCKER" && finding.subject.type !== "ASSIGNMENT"
  );
  for (const assignment of assignments) {
    const assignmentBlocker = governance.findings.some((finding) => {
      if (finding.severity !== "BLOCKER") return false;
      if (finding.subject.type === "ASSIGNMENT") return finding.subject.id === assignment.id;
      if (finding.subject.type === assignment.entityType && finding.subject.id === assignment.entityId) {
        return true;
      }
      return false;
    });
    if (hasAggregateBlocker || assignmentBlocker) blocked.add(assignment.id);
  }
  const projected = structuredClone(program);
  for (const entity of entities(projected)) {
    entity.assignments = entity.assignments.filter((assignment) => !blocked.has(assignment.id));
  }
  const eligibleAssignmentIds = new Set(assignments
    .filter((assignment) => !blocked.has(assignment.id))
    .map((assignment) => assignment.id));
  return { program: projected, governance, eligibleAssignmentIds };
}
