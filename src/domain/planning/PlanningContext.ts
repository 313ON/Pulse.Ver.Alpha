export type PlanningContext = {
  planYear: number;
  startDate: string;
  endDate: string;
  today: string;
};

export const DEFAULT_PLANNING_CONTEXT: PlanningContext = {
  planYear: 1405,
  startDate: "1405/01/01",
  endDate: "1405/12/29",
  today: "1405/06/15"
};

function positiveYear(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

function dateOrFallback(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

export function createPlanningContext(input: Partial<PlanningContext> = {}): PlanningContext {
  const planYear = input.planYear ?? DEFAULT_PLANNING_CONTEXT.planYear;
  return {
    planYear,
    startDate: input.startDate ?? `${planYear}/01/01`,
    endDate: input.endDate ?? `${planYear}/12/29`,
    today: input.today ?? `${planYear}/06/15`
  };
}

export function getPlanningContext(env: NodeJS.ProcessEnv = process.env): PlanningContext {
  const planYear = positiveYear(env.PULSE_PLAN_YEAR, DEFAULT_PLANNING_CONTEXT.planYear);
  return createPlanningContext({
    planYear,
    startDate: dateOrFallback(env.PULSE_PLAN_START_DATE, `${planYear}/01/01`),
    endDate: dateOrFallback(env.PULSE_PLAN_END_DATE, `${planYear}/12/29`),
    today: dateOrFallback(env.PULSE_PLAN_TODAY, `${planYear}/06/15`)
  });
}
