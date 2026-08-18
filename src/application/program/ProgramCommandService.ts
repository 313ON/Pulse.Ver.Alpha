import { createProgress } from "../../domain/program/primitives";
import { validateAction } from "../../domain/program/rules";
import { ProgramGovernanceRules, type GovernanceValidationReport } from "../../domain/program";
import type { Action, ProgramStatus } from "../../domain/program";
import { ProgramMapper } from "./ProgramMapper";
import type { ProgramRepositoryPorts, UnknownRow } from "./ports";

export type ProgramAuthorizationHook = (operation: string, context: Record<string, unknown>) => void;

export type CreateActionInput = {
  publicId: string;
  goalId: string;
  objectiveId: string;
  activityId: string;
  title: string;
  workType: Action["workType"];
  departmentId: string;
  ownerPersonId: string;
  deliverable: string;
  deadline: string;
  plannedStart?: string;
  status: Action["status"];
  progress?: number;
  description?: string;
};

export class ProgramCommandService {
  private readonly governance = new ProgramGovernanceRules();

  constructor(
    private readonly ports: ProgramRepositoryPorts,
    private readonly mapper = new ProgramMapper(),
    private readonly authorize?: ProgramAuthorizationHook
  ) {}

  createGoal(input: { id: string; title: string; programId?: string }) {
    this.authorize?.("program.goal.create", input);
    const report = this.governance.validateGoal({
      ...input,
      type: "goal",
      status: "پیش‌نویس"
    });
    this.assertGovernance(report, ["goal.owner.required"]);
    const result = this.ports.goals.create(input);
    return this.mapper.goal(result as UnknownRow, input.programId ?? "");
  }

  createObjective(input: { id: string; goalId: string; title: string; ownerPersonId?: string }) {
    this.authorize?.("program.objective.create", input);
    this.requireGoal(input.goalId);
    this.assertGovernance(this.governance.validateObjective({
      ...input,
      type: "objective",
      status: "پیش‌نویس"
    }));
    return this.mapper.objective(this.ports.objectives.create(input) as UnknownRow);
  }

  createActivity(input: { id?: string; objectiveId: string; title: string; description?: string; ownerPersonId?: string }) {
    this.authorize?.("program.activity.create", input);
    this.requireObjective(input.objectiveId);
    this.assertGovernance(this.governance.validateActivity({
      ...input,
      id: input.id ?? "",
      type: "activity",
      status: "پیش‌نویس"
    }));
    const result = this.ports.activities.create({
      id: input.id,
      subGoalId: input.objectiveId,
      title: input.title,
      description: input.description,
      ownerPersonId: input.ownerPersonId
    });
    return this.mapper.activity(result as UnknownRow);
  }

  createAction(input: CreateActionInput) {
    this.authorize?.("program.action.create", input);
    const objective = this.requireObjective(input.objectiveId);
    const activity = this.requireActivity(input.activityId);
    const activityObjectiveId = String((activity as UnknownRow).sub_goal_id ?? (activity as UnknownRow).objectiveId ?? "");
    if (activityObjectiveId !== input.objectiveId) throw new Error("The activity does not belong to the selected objective.");
    const goalId = String((objective as UnknownRow).goal_id ?? (objective as UnknownRow).goalId ?? "");
    if (goalId !== input.goalId) throw new Error("The objective does not belong to the selected goal.");

    const action = this.mapper.action({
      id: input.publicId,
      public_id: input.publicId,
      goal_id: input.goalId,
      sub_goal_id: input.objectiveId,
      activity_id: input.activityId,
      title: input.title,
      work_type: input.workType,
      department_id: input.departmentId,
      owner_person_id: input.ownerPersonId,
      deliverable: input.deliverable,
      planned_end: input.deadline,
      planned_start: input.plannedStart,
      status: input.status,
      progress: input.progress ?? 0,
      description: input.description
    });
    this.assertGovernance(this.governance.validateAction({
      ...input,
      id: input.publicId,
      type: "action",
      owner: input.ownerPersonId,
      deadline: input.deadline
    }));
    const errors = validateAction(action, new Set([input.goalId]));
    if (errors.length) throw new Error(errors.join(" "));
    const result = this.ports.actions.create({
      ...input,
      progress: input.progress ?? 0,
      activityId: input.activityId,
      departmentId: input.departmentId,
      ownerPersonId: input.ownerPersonId,
      publicId: input.publicId,
      goalId: input.goalId,
      subGoalId: input.objectiveId,
      deadline: input.deadline,
      plannedStart: input.plannedStart,
      workType: input.workType,
      status: input.status
    });
    return this.mapper.action(result as UnknownRow);
  }

  updateProgress(publicId: string, progress: number) {
    this.authorize?.("program.action.progress", { publicId, progress });
    const action = this.ports.actions.get(publicId);
    if (!action) throw new Error("The action was not found.");
    const bounded = createProgress(progress);
    return this.mapper.action(this.ports.actions.update(publicId, { progress: Number(bounded) }) as UnknownRow);
  }

  updateActionStatus(publicId: string, status: ProgramStatus) {
    this.authorize?.("program.action.status", { publicId, status });
    const current = this.ports.actions.get(publicId) as UnknownRow | undefined;
    if (!current) throw new Error("The action was not found.");
    const from = String(current.status ?? "پیش‌نویس") as ProgramStatus;
    this.assertGovernance(this.governance.validateStatusTransition({ ...current, id: publicId, type: "action" }, from, status));
    return this.mapper.action(this.ports.actions.update(publicId, { status }) as UnknownRow);
  }

  validateKPI(input: Record<string, unknown>): GovernanceValidationReport {
    return this.governance.validateKPI({ ...input, type: "kpi" });
  }

  private assertGovernance(report: GovernanceValidationReport, warnings: string[] = []) {
    const blocking = report.violations.filter((violation) => violation.severity === "error" && !warnings.includes(violation.rule));
    if (blocking.length) throw new Error(blocking.map((violation) => violation.message).join(" "));
  }

  private requireGoal(id: string): UnknownRow {
    const goal = this.ports.goals.get(id) as UnknownRow | undefined;
    if (!goal) throw new Error("The related goal does not exist.");
    return goal;
  }

  private requireObjective(id: string): UnknownRow {
    const objective = this.ports.objectives.get(id) as UnknownRow | undefined;
    if (!objective) throw new Error("The related objective does not exist.");
    return objective;
  }

  private requireActivity(id: string): UnknownRow {
    const activity = this.ports.activities.getUnscoped(id) as UnknownRow | undefined;
    if (!activity) throw new Error("The related activity does not exist.");
    return activity;
  }
}
