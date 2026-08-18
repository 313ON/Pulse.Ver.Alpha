import type { Action, Goal, KPI, Objective, Program, Activity, ProgramStatus, Progress } from "../../domain/program";

export type ProgramKpiSummary = {
  total: number;
  healthy: number;
  atRisk: number;
  withoutMeasurement: number;
};

export type ProgramSummary = {
  goalCount: number;
  objectiveCount: number;
  activityCount: number;
  actionCount: number;
  kpiCount: number;
  averageProgress: number;
  completedActions: number;
  blockedActions: number;
  kpis: ProgramKpiSummary;
};

export type ProgramReadModel = {
  hierarchy: Program;
  summary: ProgramSummary;
};

export type ProgramNodeSnapshot = {
  id: string;
  type: "program" | "goal" | "objective" | "activity" | "action" | "kpi";
  status: ProgramStatus;
  progress: Progress;
};

export type ProgramCollections = {
  goals: Goal[];
  objectives: Objective[];
  activities: Activity[];
  actions: Action[];
  kpis: KPI[];
};
