import { getKpiHealth } from "../../domain/program/rules";
import type { Goal, Program } from "../../domain/program";
import type { ProgramReadModel } from "../program/ProgramReadModel";
import { ProgramMapper } from "../program/ProgramMapper";
import { getReadOnlyDatabase } from "../../server/db";

type Row = Record<string, unknown>;

export class ReadOnlyProgramQueryService {
  constructor(private readonly mapper = new ProgramMapper()) {}

  getProgram(descriptor: {
    id: string;
    title: string;
    description?: string;
    status?: Program["status"];
    priority?: Goal["priority"];
    start?: string;
    end?: string;
  }): ProgramReadModel {
    const database = getReadOnlyDatabase();
    const goals = (database.prepare(
      "SELECT * FROM strategic_goals WHERE plan_year = 1405 ORDER BY id"
    ).all() as Row[]).map((row) => this.mapper.goal(row, descriptor.id));
    const objectives = (database.prepare(
      "SELECT * FROM sub_goals ORDER BY id"
    ).all() as Row[]).map((row) => this.mapper.objective(row));
    const activities = (database.prepare(
      "SELECT * FROM activities ORDER BY id"
    ).all() as Row[]).map((row) => this.mapper.activity(row));
    const actionRows = database.prepare(`
      SELECT w.*, p.full_name AS owner, d.name AS department
      FROM work_items w
      JOIN people p ON p.id = w.owner_person_id
      JOIN departments d ON d.id = w.department_id
      WHERE w.plan_year = 1405
      ORDER BY w.planned_end, w.public_id
    `).all() as Row[];
    const actions = actionRows.map((row) => this.mapper.action(row));
    const kpiRows = database.prepare("SELECT * FROM kpis ORDER BY name").all() as Row[];
    const actionByInternalId = new Map(actionRows.flatMap((row, index) => [
      [String(row.id ?? ""), actions[index]] as const,
      [String(row.public_id ?? ""), actions[index]] as const
    ]));
    const kpis = kpiRows.map((row) => {
      const action = actionByInternalId.get(String(row.work_item_id ?? ""));
      return this.mapper.kpi(row, action?.id);
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
    const allKpis = goals.flatMap((goal) => goal.objectives)
      .flatMap((objective) => objective.activities)
      .flatMap((activity) => activity.actions)
      .flatMap((action) => action.kpis);
    const allActions = goals.flatMap((goal) => goal.objectives)
      .flatMap((objective) => objective.activities)
      .flatMap((activity) => activity.actions);

    return {
      hierarchy,
      summary: {
        goalCount: goals.length,
        objectiveCount: objectives.length,
        activityCount: activities.length,
        actionCount: allActions.length,
        kpiCount: allKpis.length,
        averageProgress: allActions.length
          ? Math.round(allActions.reduce((sum, action) => sum + action.progress, 0) / allActions.length)
          : 0,
        completedActions: allActions.filter((action) => action.status === "تکمیل شده").length,
        blockedActions: allActions.filter((action) => action.status === "مسدود").length,
        kpis: {
          total: allKpis.length,
          healthy: allKpis.filter((kpi) => getKpiHealth(kpi) === "سبز").length,
          atRisk: allKpis.filter((kpi) => ["زرد", "قرمز"].includes(getKpiHealth(kpi))).length,
          withoutMeasurement: allKpis.filter((kpi) => kpi.target === 0).length
        }
      }
    };
  }
}
