import type { SessionUser } from "../../server/auth";

export type UnknownRow = Record<string, unknown>;

export type GoalRepositoryPort = {
  list(): unknown[];
  get(id: string): unknown;
  create(input: { id: string; title: string }): unknown;
};

export type ObjectiveRepositoryPort = {
  list(): unknown[];
  get(id: string): unknown;
  create(input: { id: string; goalId: string; title: string; ownerPersonId?: string }): unknown;
};

export type ActivityRepositoryPort = {
  list(user?: SessionUser): unknown[];
  get(id: string, user?: SessionUser): unknown;
  getUnscoped(id: string): unknown;
  create(input: { id?: string; subGoalId: string; title: string; description?: string; ownerPersonId?: string }): unknown;
};

export type ActionRepositoryPort = {
  list(user?: SessionUser): unknown[];
  get(publicId: string, user?: SessionUser): unknown;
  create(input: Record<string, unknown>): unknown;
  update(publicId: string, input: Record<string, unknown>): unknown;
};

export type KpiRepositoryPort = {
  list(): unknown[];
  get(id: string): unknown;
};

export type ProgramRepositoryPorts = {
  goals: GoalRepositoryPort;
  objectives: ObjectiveRepositoryPort;
  activities: ActivityRepositoryPort;
  actions: ActionRepositoryPort;
  kpis: KpiRepositoryPort;
};
