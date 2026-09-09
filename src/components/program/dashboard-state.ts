import type { Program } from "../../domain/program";

export type DashboardState =
  | { kind: "loading" }
  | { kind: "empty"; planYear: string; lastUpdated: string }
  | { kind: "partial"; program: Program; missing: string[]; lastUpdated: string }
  | { kind: "ready"; program: Program; lastUpdated: string }
  | { kind: "recoverable-error"; message: string }
  | { kind: "blocking-error"; message: string; guidance: string };

export function classifyDashboardData(program: Program, lastUpdated = new Date().toISOString()): Extract<DashboardState, { kind: "empty" | "partial" | "ready" }> {
  const goals = program.goals;
  const actions = goals.flatMap((goal) => goal.objectives.flatMap((objective) => objective.activities.flatMap((activity) => activity.actions)));
  const missing: string[] = [];

  if (goals.length === 0) return { kind: "empty", planYear: program.timeline.start.split("/")[0], lastUpdated };
  if (actions.length === 0) missing.push("اقدام‌های متصل");
  if (goals.some((goal) => goal.objectives.length === 0)) missing.push("اهداف جزئی");
  if (missing.length > 0) return { kind: "partial", program, missing: [...new Set(missing)], lastUpdated };
  return { kind: "ready", program, lastUpdated };
}
