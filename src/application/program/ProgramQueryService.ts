import { getKpiHealth } from "../../domain/program/rules";
import type { Goal, ProgramStatus } from "../../domain/program";
import type { ProgramReadModel, ProgramSummary } from "./ProgramReadModel";
import { ProgramMapper } from "./ProgramMapper";
import type { ProgramRepositoryPorts, UnknownRow } from "./ports";

export type ProgramDescriptor = {
  id: string;
  title: string;
  description?: string;
  owner?: string;
  status?: ProgramStatus;
  priority?: Goal["priority"];
  start?: string;
  end?: string;
};

export class ProgramQueryService {
  constructor(
    private readonly ports: ProgramRepositoryPorts,
    private readonly mapper = new ProgramMapper()
  ) {}

  getProgram(descriptor: ProgramDescriptor): ProgramReadModel {
    const goalRows = this.ports.goals.list().map((row) => row as UnknownRow);
    const objectiveRows = this.ports.objectives.list().map((row) => row as UnknownRow);
    const activityRows = this.ports.activities.list().map((row) => row as UnknownRow);
    const actionRows = this.ports.actions.list().map((row) => row as UnknownRow);
    const kpiRows = this.ports.kpis.list().map((row) => row as UnknownRow);

    const goals = goalRows.map((row) => this.mapper.goal(row, descriptor.id));
    const objectives = objectiveRows.map((row) => this.mapper.objective(row));
    const activities = activityRows.map((row) => this.mapper.activity(row));
    const actions = actionRows.map((row) => this.mapper.action(row));
    const actionByInternalId = new Map(
      actionRows.flatMap((row, index) => [
        [String(row.id ?? row.public_id), actions[index]] as const,
        [String(row.public_id ?? row.id), actions[index]] as const
      ])
    );
    const kpis = kpiRows.map((row) => {
      const directActionId = String(row.actionId ?? "");
      const action = directActionId ? actions.find((candidate) => candidate.id === directActionId) : actionByInternalId.get(String(row.work_item_id ?? ""));
      return this.mapper.kpi(row, action?.id ?? (directActionId || undefined));
    });

    for (const goal of goals) {
      goal.objectives = objectives.filter((objective) => objective.goalId === goal.id);
      for (const objective of goal.objectives) {
        objective.activities = activities.filter((activity) => activity.objectiveId === objective.id);
        for (const activity of objective.activities) {
          activity.actions = actions.filter((action) => action.activityId === activity.id);
          for (const action of activity.actions) {
            action.kpis = kpis.filter((kpi) => kpi.actionId === action.id);
          }
        }
      }
    }

    const hierarchy = this.mapper.program({ ...descriptor, goals });
    return { hierarchy, summary: this.summarize(hierarchy.goals, kpis) };
  }

  private summarize(goals: Goal[], kpis: ReturnType<ProgramMapper["kpi"]>[]): ProgramSummary {
    const objectives = goals.flatMap((goal) => goal.objectives);
    const activities = objectives.flatMap((objective) => objective.activities);
    const actions = activities.flatMap((activity) => activity.actions);
    const healthy = kpis.filter((kpi) => getKpiHealth(kpi) === "سبز").length;
    const atRisk = kpis.filter((kpi) => getKpiHealth(kpi) === "زرد" || getKpiHealth(kpi) === "قرمز").length;
    return {
      goalCount: goals.length,
      objectiveCount: objectives.length,
      activityCount: activities.length,
      actionCount: actions.length,
      kpiCount: kpis.length,
      averageProgress: actions.length ? Math.round(actions.reduce((sum, action) => sum + action.progress, 0) / actions.length) : 0,
      completedActions: actions.filter((action) => action.status === "تکمیل شده").length,
      blockedActions: actions.filter((action) => action.status === "مسدود").length,
      kpis: {
        total: kpis.length,
        healthy,
        atRisk,
        withoutMeasurement: kpis.filter((kpi) => kpi.target === 0).length
      }
    };
  }
}
