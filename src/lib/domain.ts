import type { ActionStatus, Health } from "./data";
import { kpiRecordToKPI, workItemToAction } from "../domain/program/mappings";
import { calculatePulseScore as calculateCanonicalPulseScore } from "../domain/program/metrics";
import { getKpiHealth as getCanonicalKpiHealth, isActionOverdue } from "../domain/program/rules";

export type WorkType = "پروژه" | "اقدام" | "فعالیت تکرارشونده" | "پایش KPI" | "Milestone";
export type RiskStatus = "باز" | "کنترل‌شده" | "بسته";
export type DependencyStatus = "باز" | "حل‌شده";

export interface WorkItem {
  publicId: string;
  goalId?: string;
  subGoalId?: string;
  activityId?: string;
  title: string;
  workType: WorkType;
  ownerPersonId?: string;
  departmentId?: string;
  priority?: "بحرانی" | "زیاد" | "متوسط" | "کم";
  deliverable?: string;
  deadline?: string;
  plannedStart?: string;
  actualCompletion?: string;
  blocker?: string;
  notes?: string;
  externalIdentifiers?: Record<string, string>;
  status: ActionStatus;
  progress: number;
}

export interface Dependency {
  sourceWorkItemId: string;
  targetWorkItemId: string;
  status: DependencyStatus;
  delayDays: number;
}

export interface KpiRecord {
  id: string;
  name: string;
  actual: number;
  target: number;
  direction: "higher-is-better" | "lower-is-better";
  unit?: string;
  health?: Health;
}

export interface RiskRecord {
  id: string;
  title: string;
  probability: number;
  impact: number;
  status: RiskStatus;
  responseAction?: string;
}

export interface ProgramQuality {
  missingOwner: number;
  missingDeliverable: number;
  missingKpi: number;
  missingDeadline: number;
  actionWithoutGoal: number;
  goalWithoutAction: number;
  duplicateActions: number;
  unresolvedDependencies: number;
  overdue: number;
  overloadedOwners: number;
}

export interface PulseScoreBreakdown {
  goalProgress: number;
  executionControl: number;
  overdueControl: number;
  blockedControl: number;
  kpiHealth: number;
  criticalRiskControl: number;
  total: number;
}

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(digit);
    if (persianIndex >= 0) return String(persianIndex);
    return String(ARABIC_DIGITS.indexOf(digit));
  });
}

export function parseJalaliDate(value?: string): [number, number, number] | null {
  if (!value) return null;
  const match = normalizeDigits(value).trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return [year, month, day];
}

export function compareJalaliDates(left?: string, right?: string): number | null {
  const leftParts = parseJalaliDate(left);
  const rightParts = parseJalaliDate(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] > rightParts[index] ? 1 : -1;
  }
  return 0;
}

export function isOverdue(deadline: string | undefined, today: string, status: ActionStatus): boolean {
  if (!deadline) return false;
  return isActionOverdue({ plannedEnd: deadline, status }, today);
}

export function canTransitionStatus(from: ActionStatus, to: ActionStatus): boolean {
  if (from === to) return true;
  if (from === "لغو شده" || from === "تکمیل شده") return false;
  if (to === "تکمیل شده") return true;
  if (to === "لغو شده") return true;
  return true;
}

export function riskSeverity(probability: number, impact: number): number {
  return Math.max(1, Math.min(5, probability)) * Math.max(1, Math.min(5, impact));
}

export function getKpiHealth(kpi: KpiRecord): Health {
  return getCanonicalKpiHealth(kpiRecordToKPI(kpi));
}

export function validateWorkItem(item: WorkItem, validGoalIds: Set<string>): string[] {
  const errors: string[] = [];
  if (!/^G\d{2}-O\d{2}-A\d{2}-T\d{3}$/.test(item.publicId)) errors.push("شناسه اقدام معتبر نیست.");
  if (!item.goalId || !validGoalIds.has(item.goalId)) errors.push("هدف کلان معتبر الزامی است.");
  if (!item.title.trim()) errors.push("عنوان اقدام الزامی است.");
  if (!item.ownerPersonId) errors.push("مسئول اقدام الزامی است.");
  if (!item.deliverable?.trim()) errors.push("خروجی اقدام الزامی است.");
  if (!item.deadline || !parseJalaliDate(item.deadline)) errors.push("موعد معتبر الزامی است.");
  if (item.progress < 0 || item.progress > 100 || !Number.isInteger(item.progress)) errors.push("پیشرفت باید عدد صحیح بین ۰ تا ۱۰۰ باشد.");
  if (item.plannedStart && item.deadline && compareJalaliDates(item.plannedStart, item.deadline) === 1) errors.push("تاریخ شروع نباید بعد از موعد باشد.");
  if (item.status === "تکمیل شده" && item.progress !== 100) errors.push("اقدام تکمیل‌شده باید پیشرفت ۱۰۰٪ داشته باشد.");
  if (item.status === "مسدود" && !item.title.trim()) errors.push("اقدام مسدود باید توضیح مانع داشته باشد.");
  return errors;
}

export function inspectProgramQuality(
  items: WorkItem[],
  goalIds: Set<string>,
  kpiItemIds: Set<string>,
  dependencies: Dependency[] = [],
  today = "1405/06/15"
): ProgramQuality {
  const duplicateKeys = new Set<string>();
  let duplicateActions = 0;
  for (const item of items) {
    const key = `${item.goalId ?? "بدون هدف"}:${item.title.trim().toLocaleLowerCase("fa")}`;
    if (duplicateKeys.has(key)) duplicateActions += 1;
    duplicateKeys.add(key);
  }
  const ownerCounts = new Map<string, number>();
  items.forEach((item) => item.ownerPersonId && ownerCounts.set(item.ownerPersonId, (ownerCounts.get(item.ownerPersonId) ?? 0) + 1));
  const goalsWithActions = new Set(items.map((item) => item.goalId).filter(Boolean));
  return {
    missingOwner: items.filter((item) => !item.ownerPersonId).length,
    missingDeliverable: items.filter((item) => !item.deliverable?.trim()).length,
    missingKpi: items.filter((item) => !kpiItemIds.has(item.publicId)).length,
    missingDeadline: items.filter((item) => !item.deadline).length,
    actionWithoutGoal: items.filter((item) => !item.goalId || !goalIds.has(item.goalId)).length,
    goalWithoutAction: [...goalIds].filter((goalId) => !goalsWithActions.has(goalId)).length,
    duplicateActions,
    unresolvedDependencies: dependencies.filter((dependency) => dependency.status !== "حل‌شده" || dependency.delayDays > 0).length,
    overdue: items.filter((item) => isOverdue(item.deadline, today, item.status)).length,
    overloadedOwners: [...ownerCounts.values()].filter((count) => count > 8).length
  };
}

export function calculatePulseScore(
  goalProgress: number[],
  items: WorkItem[],
  kpis: KpiRecord[],
  risks: RiskRecord[],
  today = "1405/06/15"
): PulseScoreBreakdown {
  return calculateCanonicalPulseScore(
    goalProgress,
    items.map((item) => workItemToAction(item)),
    kpis.map((kpi) => kpiRecordToKPI(kpi)),
    risks,
    today
  );
}
