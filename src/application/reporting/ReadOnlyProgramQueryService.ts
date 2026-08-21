import { getKpiHealth } from "../../domain/program/rules";
import type { Goal, Program } from "../../domain/program";
import type { ProgramReadModel } from "../program/ProgramReadModel";
import { ProgramMapper } from "../program/ProgramMapper";
import type { OperationalProgramReadPort } from "./ports";
import { parseWorkItemHierarchyIdentity } from "./ProgramEntityIdentity";
import { getPlanningContext, type PlanningContext } from "../../domain/planning";

export class ReadOnlyProgramQueryService {
  constructor(
    private readonly readRepository: OperationalProgramReadPort,
    private readonly mapper = new ProgramMapper(),
    private readonly planning: PlanningContext = getPlanningContext()
  ) {}

  getProgram(descriptor: {
    id: string;
    title: string;
    description?: string;
    status?: Program["status"];
    priority?: Goal["priority"];
    start?: string;
    end?: string;
  }): ProgramReadModel {
    const planYear = this.planning.planYear;
    const goals = this.readRepository.listGoals(planYear)
      .map((row) => this.mapper.goal(row, descriptor.id));
    const objectives = this.readRepository.listObjectives(planYear)
      .map((row) => this.mapper.objective(row));
    const activities = this.readRepository.listActivities(planYear)
      .map((row) => this.mapper.activity(row));
    const actionRows = this.readRepository.listActions(planYear);
    const assignmentsByActionId = this.readRepository.listActionAssignments(planYear);
    const actions = actionRows.map((row) => {
      const identity = parseWorkItemHierarchyIdentity(String(row.public_id ?? ""));
      return this.mapper.action({
        ...row,
        sub_goal_id: row.sub_goal_id ?? identity?.objectiveId,
        activity_id: row.activity_id ?? identity?.activityId,
        assignments: assignmentsByActionId.get(String(row.public_id ?? "")) ?? []
      });
    });
    const kpiRows = this.readRepository.listKpis(planYear);
    const actionByInternalId = new Map(actionRows.flatMap((row, index) => [
      [String(row.id ?? ""), actions[index]] as const,
      [String(row.public_id ?? ""), actions[index]] as const
    ]));
    const kpis = kpiRows.map((row) => {
      const action = actionByInternalId.get(String(row.work_item_id ?? ""));
      return this.mapper.kpi(row, action?.id);
    });

    const objectiveById = new Map(objectives.map((objective) => [objective.id, objective]));
    const activityById = new Map(activities.map((activity) => [activity.id, activity]));
    for (const row of actionRows) {
      const identity = parseWorkItemHierarchyIdentity(String(row.public_id ?? ""));
      if (!identity) continue;
      const objectiveId = String(row.sub_goal_id ?? identity.objectiveId);
      const activityId = String(row.activity_id ?? identity.activityId);
      if (!objectiveById.has(objectiveId)) {
        const objective = this.mapper.objective({
          id: objectiveId,
          goal_id: row.goal_id ?? identity.goalId,
          title: `هدف جزئی ${identity.objectiveCode} (عنوان ثبت نشده)`,
          status: "نیازمند تکمیل"
        });
        objectives.push(objective);
        objectiveById.set(objective.id, objective);
      }
      if (!activityById.has(activityId)) {
        const activity = this.mapper.activity({
          id: activityId,
          sub_goal_id: objectiveId,
          title: `فعالیت ${identity.activityCode} (عنوان ثبت نشده)`,
          status: "نیازمند تکمیل"
        });
        activities.push(activity);
        activityById.set(activity.id, activity);
      }
    }

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
