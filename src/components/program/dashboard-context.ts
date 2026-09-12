export type DashboardContext = { planYear: number; organizationalUnitId: string };
export const ALL_ORGANIZATIONAL_UNITS = "ALL";
export type DashboardContextOptions = { planYears: number[]; organizationalUnits: Array<{ id: string; name: string }> };

export function dashboardContextToSearchParams(context: DashboardContext, current = new URLSearchParams()): URLSearchParams {
  const params = new URLSearchParams(current);
  params.set("planCycle", String(context.planYear));
  params.set("unit", context.organizationalUnitId);
  return params;
}

export function dashboardContextFromSearchParams(params: URLSearchParams, fallback: DashboardContext): DashboardContext {
  const planYear = Number(params.get("planCycle"));
  return {
    planYear: Number.isInteger(planYear) && planYear > 0 ? planYear : fallback.planYear,
    organizationalUnitId: params.get("unit") || fallback.organizationalUnitId
  };
}

export function normalizeDashboardContext(context: DashboardContext, options: DashboardContextOptions, fallback: DashboardContext): DashboardContext {
  return {
    planYear: options.planYears.includes(context.planYear) ? context.planYear : fallback.planYear,
    organizationalUnitId: context.organizationalUnitId === ALL_ORGANIZATIONAL_UNITS || options.organizationalUnits.some((unit) => unit.id === context.organizationalUnitId) ? context.organizationalUnitId : fallback.organizationalUnitId
  };
}
