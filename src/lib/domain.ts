import type { ActionStatus, Health } from "./data";

export type WorkType = "پروژه" | "اقدام" | "فعالیت تکرارشونده" | "پایش KPI" | "Milestone";
export type RiskStatus = "باز" | "کنترل‌شده" | "بسته";
export type DependencyStatus = "باز" | "حل‌شده";

export interface WorkItem {
  publicId: string;
  goalId?: string;
  subGoalId?: string;
  title: string;
  workType: WorkType;
  ownerPersonId?: string;
  departmentId?: string;
  deliverable?: string;
  deadline?: string;
  plannedStart?: string;
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
  return status !== "تکمیل شده" && status !== "لغو شده" && compareJalaliDates(deadline, today) === -1;
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
  if (kpi.target === 0) return "خاکستری";
  if (kpi.direction === "lower-is-better" && kpi.actual === 0) return "سبز";
  if (kpi.direction === "higher-is-better" && kpi.actual === 0) return "قرمز";
  const ratio = kpi.direction === "higher-is-better" ? kpi.actual / kpi.target : kpi.target / kpi.actual;
  if (ratio >= 1) return "سبز";
  if (ratio >= 0.85) return "زرد";
  return "قرمز";
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
  const boundedAverage = (values: number[]) => values.length ? values.reduce((sum, value) => sum + Math.max(0, Math.min(100, value)), 0) / values.length : 0;
  const overdue = items.filter((item) => isOverdue(item.deadline, today, item.status)).length;
  const blocked = items.filter((item) => item.status === "مسدود").length;
  const active = items.filter((item) => item.status !== "لغو شده").length;
  const healthyKpis = kpis.filter((kpi) => getKpiHealth(kpi) === "سبز").length;
  const criticalRisks = risks.filter((risk) => riskSeverity(risk.probability, risk.impact) >= 15 && risk.status !== "بسته").length;
  const goalComponent = boundedAverage(goalProgress);
  const executionControl = active ? (items.filter((item) => item.status === "تکمیل شده").length / active) * 100 : 0;
  const overdueControl = active ? (1 - overdue / active) * 100 : 100;
  const blockedControl = active ? (1 - blocked / active) * 100 : 100;
  const kpiHealth = kpis.length ? (healthyKpis / kpis.length) * 100 : 0;
  const criticalRiskControl = risks.length ? (1 - criticalRisks / risks.length) * 100 : 100;
  const total = Math.round(goalComponent * 0.3 + executionControl * 0.25 + overdueControl * 0.15 + blockedControl * 0.1 + kpiHealth * 0.15 + criticalRiskControl * 0.05);
  return { goalProgress: Math.round(goalComponent), executionControl: Math.round(executionControl), overdueControl: Math.round(overdueControl), blockedControl: Math.round(blockedControl), kpiHealth: Math.round(kpiHealth), criticalRiskControl: Math.round(criticalRiskControl), total };
}
