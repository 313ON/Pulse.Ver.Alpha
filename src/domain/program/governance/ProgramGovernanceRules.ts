import { canTransitionStatus, compareProgramDates } from "../rules";
import type { Assignment } from "../Assignment";
import type { ProgramNode, ProgramStatus } from "../types";
import {
  createGovernanceReport,
  type GovernanceEntityType,
  type GovernanceSeverity,
  type GovernanceValidationReport,
  type GovernanceViolation
} from "./GovernanceViolation";

type RecordLike = Record<string, unknown>;

export type AssignmentValidationOptions = {
  validPersonIds?: ReadonlySet<string>;
  validUnitIds?: ReadonlySet<string>;
};

const text = (value: unknown): string => value === undefined || value === null ? "" : String(value).trim();
const firstText = (entity: RecordLike, ...keys: string[]): string => {
  for (const key of keys) {
    const value = text(entity[key]);
    if (value) return value;
  }
  return "";
};
const idOf = (entity: RecordLike): string => firstText(entity, "id", "publicId", "public_id");
const add = (
  violations: GovernanceViolation[],
  entity: RecordLike,
  entityType: GovernanceEntityType,
  rule: string,
  message: string,
  severity: GovernanceSeverity = "error"
) => violations.push({ entityId: idOf(entity), entityType, rule, severity, message });

export class ProgramGovernanceRules {
  validateProgram(program: Partial<ProgramNode> & RecordLike): GovernanceValidationReport {
    const violations: GovernanceViolation[] = [];
    this.validateIdentityAndLifecycle(program, "program", violations);
    return createGovernanceReport(violations);
  }

  validateGoal(goal: RecordLike): GovernanceValidationReport {
    const violations: GovernanceViolation[] = [];
    this.validateIdentityAndLifecycle(goal, "goal", violations);
    if (!firstText(goal, "owner", "ownerId", "ownerPersonId", "owner_person_id")) {
      add(violations, goal, "goal", "goal.owner.required", "Goal owner is required.");
    }
    return createGovernanceReport(violations);
  }

  validateObjective(objective: RecordLike): GovernanceValidationReport {
    const violations: GovernanceViolation[] = [];
    this.validateIdentityAndLifecycle(objective, "objective", violations);
    if (!firstText(objective, "goalId", "goal_id", "parentGoalId", "parent_goal_id")) {
      add(violations, objective, "objective", "objective.parentGoal.required", "Objective parent Goal is required.");
    }
    if (!firstText(objective, "measurableOutcome", "measurable_outcome", "outcome", "description", "title")) {
      add(violations, objective, "objective", "objective.outcome.required", "Objective measurable outcome is required.");
    }
    return createGovernanceReport(violations);
  }

  validateActivity(activity: RecordLike, options: AssignmentValidationOptions = {}): GovernanceValidationReport {
    const violations: GovernanceViolation[] = [];
    this.validateIdentityAndLifecycle(activity, "activity", violations);
    if (!firstText(activity, "objectiveId", "objective_id", "subGoalId", "sub_goal_id", "parentObjectiveId")) {
      add(violations, activity, "activity", "activity.parentObjective.required", "Activity parent Objective is required.");
    }
    this.validateAssignments(activity, "activity", violations, options);
    return createGovernanceReport(violations);
  }

  validateAction(action: RecordLike, options: AssignmentValidationOptions = {}): GovernanceValidationReport {
    const violations: GovernanceViolation[] = [];
    this.validateIdentityAndLifecycle(action, "action", violations);
    if (!firstText(action, "activityId", "activity_id", "parentActivityId")) {
      add(violations, action, "action", "action.parentActivity.required", "Action parent Activity is required.");
    }
    if (!firstText(action, "owner", "ownerId", "ownerPersonId", "owner_person_id")) {
      add(violations, action, "action", "action.owner.required", "Action owner is required.");
    }
    const timeline = action.timeline && typeof action.timeline === "object" ? action.timeline as RecordLike : undefined;
    if (!firstText(action, "deadline", "plannedEnd", "planned_end", "end") && !firstText(timeline ?? {}, "end")) {
      add(violations, action, "action", "action.timeline.required", "Action timeline is required.");
    }
    this.validateAssignments(action, "action", violations, options);
    return createGovernanceReport(violations);
  }

  validateAssignments(
    entity: RecordLike,
    entityType: "activity" | "action",
    violations: GovernanceViolation[],
    options: AssignmentValidationOptions = {}
  ) {
    const assignments = Array.isArray(entity.assignments) ? entity.assignments as Assignment[] : [];
    const seen = new Set<string>();
    for (const assignment of assignments) {
      const key = `${assignment.entityType}:${assignment.entityId}:${assignment.role}:${assignment.responsibilityType}`;
      if (seen.has(key)) {
        add(violations, entity, entityType, "assignment.duplicate", `Duplicate assignment "${key}" is not allowed.`);
      }
      seen.add(key);
      if (!assignment.entityId?.trim() || !assignment.displayName?.trim()) {
        add(violations, entity, entityType, "assignment.reference.required", "Assignment entity reference and display name are required.");
      }
      const validIds = assignment.entityType === "PERSON" ? options.validPersonIds : options.validUnitIds;
      if (validIds && !validIds.has(assignment.entityId)) {
        add(violations, entity, entityType, "assignment.reference.valid", `Assignment reference "${assignment.entityId}" is not valid.`);
      }
    }
    const critical = firstText(entity, "priority") === "بحرانی" || entity.critical === true;
    const hasPrimaryResponsible = assignments.some((assignment) =>
      assignment.responsibilityType === "PRIMARY"
      && (assignment.role === "EXECUTOR" || assignment.role === "OWNER")
    );
    if (critical && !hasPrimaryResponsible) {
      add(violations, entity, entityType, "assignment.primaryResponsible.required", `${entityType} requires a primary responsible assignment.`);
    }
  }

  validateKPI(kpi: RecordLike): GovernanceValidationReport {
    const violations: GovernanceViolation[] = [];
    this.validateIdentityAndLifecycle(kpi, "kpi", violations);
    const target = kpi.target;
    if (target === undefined || target === null || target === "" || !Number.isFinite(Number(target))) {
      add(violations, kpi, "kpi", "kpi.target.numeric", "KPI target must be numeric.");
    }
    if (!firstText(kpi, "unit")) add(violations, kpi, "kpi", "kpi.unit.required", "KPI unit is required.");
    if (!["higher-is-better", "lower-is-better"].includes(firstText(kpi, "direction", "measurementDirection"))) {
      add(violations, kpi, "kpi", "kpi.direction.required", "KPI measurement direction is required.");
    }
    return createGovernanceReport(violations);
  }

  validateStatusTransition(entity: RecordLike, from: ProgramStatus, to: ProgramStatus): GovernanceValidationReport {
    const violations: GovernanceViolation[] = [];
    if (!canTransitionStatus(from, to)) {
      add(violations, entity, firstText(entity, "type") || "action", "status.transition.valid", `Invalid status transition from "${from}" to "${to}".`);
    }
    return createGovernanceReport(violations);
  }

  validate(entity: RecordLike): GovernanceValidationReport {
    switch (firstText(entity, "type").toLowerCase()) {
      case "program": return this.validateProgram(entity);
      case "goal": return this.validateGoal(entity);
      case "objective": return this.validateObjective(entity);
      case "activity": return this.validateActivity(entity);
      case "action": return this.validateAction(entity);
      case "kpi": return this.validateKPI(entity);
      default: return createGovernanceReport([{
        entityId: idOf(entity),
        entityType: "unknown",
        rule: "entity.type.required",
        severity: "error",
        message: "A supported program entity type is required."
      }]);
    }
  }

  validateHierarchy(program: RecordLike): GovernanceValidationReport {
    const violations: GovernanceViolation[] = [];
    const walk = (entity: RecordLike, type: string, parentId?: string) => {
      const ownId = idOf(entity);
      const parentKey = type === "goal"
        ? "programId"
        : type === "objective"
          ? "goalId"
          : type === "activity"
            ? "objectiveId"
            : type === "action"
              ? "activityId"
              : "actionId";
      if (parentId && !firstText(entity, parentKey, "parentId")) {
        add(violations, entity, type, `${type}.parent.required`, `${type} parent is required.`);
      }
      const childrenKey = type === "program" ? "goals" : type === "goal" ? "objectives" : type === "objective" ? "activities" : type === "activity" ? "actions" : "kpis";
      for (const child of (entity[childrenKey] as RecordLike[] | undefined) ?? []) walk(child, firstText(child, "type") || (childrenKey === "kpis" ? "kpi" : childrenKey.slice(0, -1)), ownId);
    };
    walk(program, "program");
    return createGovernanceReport(violations);
  }

  private validateIdentityAndLifecycle(entity: RecordLike, type: GovernanceEntityType, violations: GovernanceViolation[]) {
    if (!idOf(entity) || !firstText(entity, "title", "name")) {
      add(violations, entity, type, `${type}.identity.required`, `${type} identity and title are required.`);
    }
    if (!firstText(entity, "status", "lifecycleState", "lifecycle_state")) {
      add(violations, entity, type, `${type}.lifecycle.required`, `${type} lifecycle state is required.`);
    }
  }
}
