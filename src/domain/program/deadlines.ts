import { compareProgramDates, programDateDistance, isActionOverdue } from "./rules";

export type DeadlineState = "missing" | "invalid" | "overdue" | "due-soon" | "scheduled" | "completed" | "cancelled";

export function classifyDeadline(action: { plannedEnd?: string | null; status: string }, today: string, windowDays = 14): DeadlineState {
  if (action.status === "تکمیل شده") return "completed";
  if (action.status === "لغو شده") return "cancelled";
  if (!action.plannedEnd) return "missing";
  if (compareProgramDates(action.plannedEnd, today) === null) return "invalid";
  if (isActionOverdue({ plannedEnd: action.plannedEnd, status: action.status as never }, today)) return "overdue";
  const remaining = programDateDistance(action.plannedEnd, today);
  return remaining !== null && remaining <= windowDays ? "due-soon" : "scheduled";
}
