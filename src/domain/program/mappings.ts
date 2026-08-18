import type { KpiRecord, WorkItem } from "../../lib/domain";
import { createProgress } from "./primitives";
import type { Action, KPI, ProgramStatus } from "./types";

const LEGACY_STATUS_MAP: Record<WorkItem["status"], ProgramStatus> = {
  "پیش‌نویس": "پیش‌نویس",
  "نیازمند تکمیل": "نیازمند تکمیل",
  "در انتظار تأیید": "در انتظار تأیید",
  "تأیید شده": "تأیید شده",
  "شروع نشده": "شروع نشده",
  "در حال اجرا": "در حال اجرا",
  "تکمیل شده": "تکمیل شده",
  "مسدود": "مسدود",
  "لغو شده": "لغو شده"
};

export function legacyStatusToProgramStatus(status: WorkItem["status"]): ProgramStatus {
  return LEGACY_STATUS_MAP[status];
}

export function workItemToAction(item: WorkItem): Action {
  const plannedEnd = item.deadline;
  const plannedStart = item.plannedStart;
  return {
    id: item.publicId,
    type: "action",
    title: item.title,
    description: item.notes ?? "",
    status: legacyStatusToProgramStatus(item.status),
    owner: item.ownerPersonId ?? "",
    ownerRef: item.ownerPersonId ? { id: item.ownerPersonId } : undefined,
    priority: item.priority ?? "متوسط",
    timeline: { start: plannedStart ?? plannedEnd ?? "", end: plannedEnd ?? "" },
    progress: createProgress(item.progress),
    goalId: item.goalId,
    objectiveId: item.subGoalId,
    activityId: item.activityId,
    department: item.departmentId ? { id: item.departmentId } : undefined,
    workType: item.workType,
    plannedStart,
    plannedEnd,
    actualCompletion: item.actualCompletion,
    deliverable: item.deliverable,
    blocker: item.blocker,
    notes: item.notes,
    externalIdentifiers: { publicId: item.publicId, ...(item.externalIdentifiers ?? {}) },
    kpis: []
  };
}

export function kpiRecordToKPI(record: KpiRecord): KPI {
  const ratio = record.target === 0 ? 0 : Math.round((record.actual / record.target) * 100);
  return {
    id: record.id,
    type: "kpi",
    title: record.name,
    description: "",
    status: "در حال اجرا",
    owner: "",
    priority: "متوسط",
    timeline: { start: "", end: "" },
    progress: createProgress(Math.max(0, Math.min(100, ratio))),
    unit: record.unit ?? "",
    target: record.target,
    actual: record.actual,
    direction: record.direction,
    measurementRule: { direction: record.direction }
  };
}
