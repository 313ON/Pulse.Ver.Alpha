import type { SessionUser } from "../auth";
import {
  ActionRepository,
  ActivityRepository,
  GoalRepository,
  KPIRepository,
  SubGoalRepository
} from "../repositories";
import { ProgramMapper } from "../../application/program/ProgramMapper";
import type {
  ActionRepositoryPort,
  ActivityRepositoryPort,
  GoalRepositoryPort,
  KpiRepositoryPort,
  ObjectiveRepositoryPort,
  ProgramRepositoryPorts
} from "../../application/program/ports";

export class GoalRepositoryAdapter implements GoalRepositoryPort {
  constructor(
    private readonly repository = new GoalRepository(),
    private readonly mapper = new ProgramMapper()
  ) {}

  list() { return this.repository.list().map((row) => this.mapper.goal(row as Record<string, unknown>, "")); }
  get(id: string) {
    const row = this.repository.get(id);
    return row ? this.mapper.goal(row as Record<string, unknown>, "") : undefined;
  }
  create(input: { id: string; title: string }) {
    return this.mapper.goal(this.repository.create(input) as Record<string, unknown>, "");
  }
}

export class ObjectiveRepositoryAdapter implements ObjectiveRepositoryPort {
  constructor(
    private readonly repository = new SubGoalRepository(),
    private readonly mapper = new ProgramMapper()
  ) {}

  list() { return this.repository.list().map((row) => this.mapper.objective(row as Record<string, unknown>)); }
  get(id: string) {
    const row = this.repository.get(id);
    return row ? this.mapper.objective(row as Record<string, unknown>) : undefined;
  }
  create(input: { id: string; goalId: string; title: string; ownerPersonId?: string }) {
    return this.mapper.objective(this.repository.create({
      ...input,
      ownerPersonId: input.ownerPersonId ?? null
    } as never) as Record<string, unknown>);
  }
}

export class ActivityRepositoryAdapter implements ActivityRepositoryPort {
  constructor(
    private readonly repository = new ActivityRepository(),
    private readonly mapper = new ProgramMapper()
  ) {}

  list(user?: SessionUser) {
    return this.repository.list(user).map((row) => this.mapper.activity(row as Record<string, unknown>));
  }
  get(id: string, user?: SessionUser) {
    const row = this.repository.get(id, user);
    return row ? this.mapper.activity(row as Record<string, unknown>) : undefined;
  }
  getUnscoped(id: string) {
    const row = this.repository.getUnscoped(id);
    return row ? this.mapper.activity(row as Record<string, unknown>) : undefined;
  }
  create(input: { id?: string; subGoalId: string; title: string; description?: string; ownerPersonId?: string }) {
    return this.mapper.activity(this.repository.create(input) as Record<string, unknown>);
  }
}

export class ActionRepositoryAdapter implements ActionRepositoryPort {
  constructor(
    private readonly repository = new ActionRepository(),
    private readonly mapper = new ProgramMapper(),
    private readonly activities = new ActivityRepository()
  ) {}

  private mapRow(row: Record<string, unknown>) {
    const activityId = String(row.activity_id ?? "");
    const activity = activityId ? this.activities.getUnscoped(activityId) as Record<string, unknown> | undefined : undefined;
    return this.mapper.action({
      ...row,
      sub_goal_id: row.sub_goal_id ?? activity?.sub_goal_id
    });
  }

  list(user?: SessionUser) {
    return this.repository.list(user).map((row) => this.mapRow(row as Record<string, unknown>));
  }
  get(publicId: string, user?: SessionUser) {
    const row = this.repository.get(publicId, user);
    return row ? this.mapRow(row as Record<string, unknown>) : undefined;
  }
  create(input: Record<string, unknown>) {
    return this.mapRow(this.repository.create({
      ...input,
      publicId: String(input.publicId ?? input.public_id ?? ""),
      goalId: String(input.goalId ?? input.goal_id ?? ""),
      subGoalId: String(input.subGoalId ?? input.sub_goal_id ?? ""),
      activityId: String(input.activityId ?? input.activity_id ?? ""),
      departmentId: String(input.departmentId ?? input.department_id ?? ""),
      ownerPersonId: String(input.ownerPersonId ?? input.owner_person_id ?? ""),
      deliverable: String(input.deliverable ?? ""),
      deadline: String(input.deadline ?? input.plannedEnd ?? input.planned_end ?? ""),
      plannedStart: input.plannedStart ?? input.planned_start,
      workType: input.workType ?? input.work_type,
      status: input.status,
      title: String(input.title ?? ""),
      progress: Number(input.progress ?? 0),
      description: input.description
    } as never) as Record<string, unknown>);
  }
  update(publicId: string, input: Record<string, unknown>) {
    return this.mapRow(this.repository.update(publicId, {
      ...input,
      goalId: input.goalId,
      activityId: input.activityId,
      departmentId: input.departmentId,
      ownerPersonId: input.ownerPersonId,
      deliverable: input.deliverable,
      deadline: input.deadline,
      plannedStart: input.plannedStart,
      workType: input.workType,
      status: input.status,
      progress: input.progress
    } as never) as Record<string, unknown>);
  }
}

export class KPIRepositoryAdapter implements KpiRepositoryPort {
  constructor(
    private readonly repository = new KPIRepository(),
    private readonly mapper = new ProgramMapper(),
    private readonly actions = new ActionRepository()
  ) {}

  list() {
    const actions = new Map(
      (this.actions.list() as Array<Record<string, unknown>>).map((row) => [
        String(row.id ?? ""),
        String(row.public_id ?? row.id ?? "")
      ])
    );
    return this.repository.list().map((row) => {
      const source = row as Record<string, unknown>;
      return this.mapper.kpi(source, actions.get(String(source.work_item_id ?? "")));
    });
  }
  get(id: string) {
    const row = this.repository.get(id);
    return row ? this.mapper.kpi(row as Record<string, unknown>) : undefined;
  }
}

export class ProgramRepositoryAdapter implements ProgramRepositoryPorts {
  readonly goals: GoalRepositoryPort;
  readonly objectives: ObjectiveRepositoryPort;
  readonly activities: ActivityRepositoryPort;
  readonly actions: ActionRepositoryPort;
  readonly kpis: KpiRepositoryPort;

  constructor(
    goals = new GoalRepositoryAdapter(),
    objectives = new ObjectiveRepositoryAdapter(),
    activities = new ActivityRepositoryAdapter(),
    actions = new ActionRepositoryAdapter(),
    kpis = new KPIRepositoryAdapter()
  ) {
    this.goals = goals;
    this.objectives = objectives;
    this.activities = activities;
    this.actions = actions;
    this.kpis = kpis;
  }
}

export function createProgramRepositoryPorts(): ProgramRepositoryPorts {
  return new ProgramRepositoryAdapter();
}
