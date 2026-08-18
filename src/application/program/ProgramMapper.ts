import { kpiRecordToKPI, workItemToAction } from "../../domain/program/mappings";
import { createProgress } from "../../domain/program/primitives";
import type { Action, Activity, EntityReference, Goal, KPI, Objective, Program, ProgramDate, ProgramStatus } from "../../domain/program";
import type { KpiRecord, WorkItem } from "../../lib/domain";
import type { UnknownRow } from "./ports";

const DEFAULT_STATUS: ProgramStatus = "در حال اجرا";

function text(row: UnknownRow, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return undefined;
}

function numberValue(row: UnknownRow, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
  }
  return undefined;
}

function progress(row: UnknownRow): ReturnType<typeof createProgress> {
  const value = Math.max(0, Math.min(100, Math.round(numberValue(row, "progress") ?? 0)));
  return createProgress(value);
}

function reference(row: UnknownRow, idKey: string, labelKey?: string): EntityReference | undefined {
  const id = text(row, idKey);
  if (!id) return undefined;
  return { id, label: labelKey ? text(row, labelKey) : undefined };
}

function baseEntity(row: UnknownRow, fallbackId: string, fallbackTitle = "") {
  const id = text(row, "id", "public_id", "publicId") ?? fallbackId;
  const title = text(row, "title", "name") ?? fallbackTitle;
  const status = (text(row, "status") as ProgramStatus | undefined) ?? DEFAULT_STATUS;
  return {
    id,
    title,
    description: text(row, "description") ?? "",
    status,
    owner: text(row, "owner", "owner_person_id", "ownerPersonId") ?? "",
    priority: (text(row, "priority") as Goal["priority"] | undefined) ?? "متوسط",
    timeline: {
      start: (text(row, "planned_start", "plannedStart") ?? "") as ProgramDate,
      end: (text(row, "planned_end", "planned_end", "deadline") ?? "") as ProgramDate
    },
    progress: progress(row)
  };
}

export class ProgramMapper {
  goal(row: UnknownRow, programId: string): Goal {
    if (row.type === "goal") return { ...(row as Goal), programId, objectives: [] };
    return {
      ...baseEntity(row, "goal"),
      type: "goal",
      programId,
      objectives: []
    };
  }

  objective(row: UnknownRow): Objective {
    if (row.type === "objective") return { ...(row as Objective), activities: [] };
    const goalId = text(row, "goal_id", "goalId") ?? "";
    return {
      ...baseEntity(row, "objective"),
      type: "objective",
      goalId,
      activities: []
    };
  }

  activity(row: UnknownRow): Activity {
    if (row.type === "activity") return { ...(row as Activity), actions: [] };
    const objectiveId = text(row, "sub_goal_id", "subGoalId") ?? "";
    return {
      ...baseEntity(row, "activity"),
      type: "activity",
      objectiveId,
      actions: []
    };
  }

  action(row: UnknownRow): Action {
    if (row.type === "action") return { ...(row as Action), kpis: [] };
    const legacy: WorkItem = {
      publicId: text(row, "public_id", "publicId", "id") ?? "",
      goalId: text(row, "goal_id", "goalId"),
      subGoalId: text(row, "sub_goal_id", "subGoalId"),
      activityId: text(row, "activity_id", "activityId"),
      title: text(row, "title") ?? "",
      workType: (text(row, "work_type", "workType") ?? "اقدام") as WorkItem["workType"],
      ownerPersonId: text(row, "owner_person_id", "ownerPersonId"),
      departmentId: text(row, "department_id", "departmentId"),
      priority: text(row, "priority") as WorkItem["priority"],
      deliverable: text(row, "deliverable"),
      deadline: text(row, "planned_end", "deadline"),
      plannedStart: text(row, "planned_start", "plannedStart"),
      actualCompletion: text(row, "actual_completion", "actualCompletion"),
      blocker: text(row, "blocker"),
      notes: text(row, "notes"),
      externalIdentifiers: row.externalIdentifiers as Record<string, string> | undefined,
      status: (text(row, "status") ?? "پیش‌نویس") as WorkItem["status"],
      progress: numberValue(row, "progress") ?? 0
    };
    const action = workItemToAction(legacy);
    return {
      ...action,
      owner: text(row, "owner") ?? action.owner,
      ownerRef: reference(row, "owner_person_id", "owner"),
      department: reference(row, "department_id", "department"),
      actualCompletion: text(row, "actual_completion", "actualCompletion"),
      description: text(row, "description") ?? action.description
    };
  }

  kpi(row: UnknownRow, actionId?: string): KPI {
    if (row.type === "kpi") return { ...(row as KPI), actionId: actionId ?? (String(row.actionId ?? "") || undefined) };
    const legacy: KpiRecord = {
      id: text(row, "id") ?? "kpi",
      name: text(row, "name", "title") ?? "",
      actual: numberValue(row, "actual") ?? 0,
      target: numberValue(row, "target") ?? 0,
      direction: (text(row, "direction") as KpiRecord["direction"] | undefined) ?? "higher-is-better",
      unit: text(row, "unit")
    };
    return {
      ...kpiRecordToKPI(legacy),
      actionId,
      owner: text(row, "owner") ?? "",
      ownerRef: reference(row, "owner_person_id", "owner"),
      description: text(row, "definition", "description") ?? ""
    };
  }

  program(input: {
    id: string;
    title: string;
    description?: string;
    owner?: string;
    status?: ProgramStatus;
    priority?: Goal["priority"];
    start?: ProgramDate;
    end?: ProgramDate;
    goals?: Goal[];
  }): Program {
    return {
      id: input.id,
      type: "program",
      title: input.title,
      description: input.description ?? "",
      status: input.status ?? DEFAULT_STATUS,
      owner: input.owner ?? "",
      priority: input.priority ?? "متوسط",
      timeline: { start: input.start ?? "", end: input.end ?? "" },
      progress: createProgress(this.averageProgress(input.goals ?? [])),
      goals: input.goals ?? []
    };
  }

  private averageProgress(goals: Goal[]): number {
    if (!goals.length) return 0;
    return Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length);
  }
}
