import type { Program } from "../../domain/program";
import type { DashboardContext } from "./dashboard-context";

export type DashboardState =
  | { kind: "loading" }
  | { kind: "empty"; planYear: string; lastUpdated: string; context?: DashboardContext }
  | { kind: "partial"; program: Program; missing: string[]; lastUpdated: string; context?: DashboardContext }
  | { kind: "ready"; program: Program; lastUpdated: string; context?: DashboardContext }
  | { kind: "recoverable-error"; message: string }
  | { kind: "blocking-error"; message: string; guidance: string };

export function classifyDashboardData(program: Program, lastUpdated = new Date().toISOString(), context?: DashboardContext): Extract<DashboardState, { kind: "empty" | "partial" | "ready" }> {
  const goals = program.goals;
  const actions = goals.flatMap((goal) => goal.objectives.flatMap((objective) => objective.activities.flatMap((activity) => activity.actions)));
  const missing: string[] = [];

  if (goals.length === 0) return { kind: "empty", planYear: program.timeline.start.split("/")[0], lastUpdated, context };
  if (actions.length === 0) missing.push("اقدام‌های متصل");
  if (goals.some((goal) => goal.objectives.length === 0)) missing.push("اهداف جزئی");
  if (missing.length > 0) return { kind: "partial", program, missing: [...new Set(missing)], lastUpdated, context };
  return { kind: "ready", program, lastUpdated, context };
}
