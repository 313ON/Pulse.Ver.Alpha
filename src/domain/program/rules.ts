import type { Action, KPI, ProgramStatus } from "./types";
import { createProgramDate, createProgress, normalizeProgramDigits } from "./primitives";

export function compareProgramDates(left?: string, right?: string): number | null {
  if (!left || !right) return null;
  const parse = (value: string) => {
    const normalized = normalizeProgramDigits(value).trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    return normalized ? normalized.slice(1).map(Number) : null;
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] > rightParts[index] ? 1 : -1;
  }
  return 0;
}

export function isActionOverdue(action: Pick<Action, "plannedEnd" | "status">, today: string): boolean {
  return action.status !== "تکمیل شده" && action.status !== "لغو شده" && compareProgramDates(action.plannedEnd, today) === -1;
}

export function getKpiHealth(kpi: Pick<KPI, "target" | "actual" | "direction">): "سبز" | "زرد" | "قرمز" | "خاکستری" {
  if (kpi.target === 0) return "خاکستری";
  if (kpi.direction === "lower-is-better" && kpi.actual === 0) return "سبز";
  if (kpi.direction === "higher-is-better" && kpi.actual === 0) return "قرمز";
  const ratio = kpi.direction === "higher-is-better" ? kpi.actual / kpi.target : kpi.target / kpi.actual;
  if (ratio >= 1) return "سبز";
  if (ratio >= 0.85) return "زرد";
  return "قرمز";
}

export function validateAction(action: Action, validGoalIds: Set<string>): string[] {
  const errors: string[] = [];
  const publicId = action.externalIdentifiers?.publicId ?? action.id;
  if (!/^G\d{2}-O\d{2}-A\d{2}-T\d{3}$/.test(publicId)) errors.push("شناسه اقدام معتبر نیست.");
  if (!action.goalId || !validGoalIds.has(action.goalId)) errors.push("هدف کلان معتبر الزامی است.");
  if (!action.title.trim()) errors.push("عنوان اقدام الزامی است.");
  if (!action.ownerRef?.id && !action.owner.trim()) errors.push("مسئول اقدام الزامی است.");
  if (!action.deliverable?.trim()) errors.push("خروجی اقدام الزامی است.");
  if (!action.plannedEnd) errors.push("موعد معتبر الزامی است.");
  else {
    try {
      createProgramDate(action.plannedEnd);
    } catch {
      errors.push("موعد معتبر الزامی است.");
    }
  }
  try {
    createProgress(action.progress);
  } catch {
    errors.push("پیشرفت باید عدد صحیح بین ۰ تا ۱۰۰ باشد.");
  }
  if (action.plannedStart && action.plannedEnd && compareProgramDates(action.plannedStart, action.plannedEnd) === 1) {
    errors.push("تاریخ شروع نباید بعد از موعد باشد.");
  }
  if (action.status === "تکمیل شده" && action.progress !== 100) {
    errors.push("اقدام تکمیل‌شده باید پیشرفت ۱۰۰٪ داشته باشد.");
  }
  return errors;
}

export function canTransitionStatus(from: ProgramStatus, to: ProgramStatus): boolean {
  if (from === to) return true;
  if (from === "لغو شده" || from === "تکمیل شده") return false;
  return true;
}
