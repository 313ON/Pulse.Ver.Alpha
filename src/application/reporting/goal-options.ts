import type { Program } from "../../domain/program";
import type { GovernedOperationalReport } from "./contracts";

export function governedGoalOptions(report: GovernedOperationalReport, program: Program): Array<{ id: string; title: string }> {
  const visibleGoalIds = new Set(report.rows.map((row) => row.goalId).filter((id): id is string => Boolean(id)));
  return program.goals
    .filter((goal) => visibleGoalIds.has(goal.id))
    .map((goal) => ({ id: goal.id, title: goal.title }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
