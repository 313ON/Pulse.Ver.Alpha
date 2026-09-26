import { getPlanningContext } from "../domain/planning";
import { classifyDashboardData, type DashboardState } from "../components/program/dashboard-state";
import { createProgramServices } from "./program";
import { getDatabase } from "./db";
import type { SessionUser } from "./auth";
import type { DashboardContext, DashboardContextOptions } from "../components/program/dashboard-context";
import { ALL_ORGANIZATIONAL_UNITS } from "../components/program/dashboard-context";
import { ActionRepository } from "./repositories";

export function getDashboardContextOptions(): DashboardContextOptions {
  const db = getDatabase();
  const planYears = (db.prepare("SELECT DISTINCT plan_year FROM strategic_goals ORDER BY plan_year DESC").all() as Array<{ plan_year: number }>).map((row) => row.plan_year);
  const organizationalUnits = db.prepare("SELECT id, name FROM departments WHERE active = 1 ORDER BY name").all() as Array<{ id: string; name: string }>;
  return { planYears, organizationalUnits };
}

export function loadDashboardState(user: SessionUser, context: DashboardContext): DashboardState {
  const planning = getPlanningContext();
  const { query } = createProgramServices();
  const program = query.getProgram({
    id: `program-${planning.planYear}`,
    title: `برنامه سالانه تحول دیجیتال سازمان در چرخه ${planning.planYear}`,
    description: `نقشه اجرایی یکپارچه تحول دیجیتال سازمان در چرخه برنامه‌ریزی سالانه ${planning.planYear}`,
    status: "در حال اجرا",
    priority: "بحرانی",
    start: planning.startDate,
    end: planning.endDate,
    context,
    user
  }).hierarchy;
  const dashboardState = classifyDashboardData(program, new Date().toISOString(), context);
  if (dashboardState.kind === "partial") {
    const calendarEvents = (new ActionRepository().list(user, context) as Array<Record<string, unknown>>)
      .filter((row) => typeof row.planned_end === "string" && row.planned_end.trim())
      .map((row) => ({ date: String(row.planned_end), label: String(row.title ?? row.public_id ?? "اقدام") }));
    return { ...dashboardState, calendarEvents };
  }
  return dashboardState;
}

export function defaultDashboardContext(): DashboardContext {
  return { planYear: getPlanningContext().planYear, organizationalUnitId: ALL_ORGANIZATIONAL_UNITS };
}

export function resolveDashboardContext(
  options: DashboardContextOptions,
  input: { planCycle?: string; unit?: string },
  user?: SessionUser
): DashboardContext {
  const defaults = defaultDashboardContext();
  const requestedPlanYear = Number(input.planCycle);
  const planYear = options.planYears.includes(requestedPlanYear) ? requestedPlanYear : defaults.planYear;
  const requestedUnit = input.unit || defaults.organizationalUnitId;
  const validUnit = requestedUnit === ALL_ORGANIZATIONAL_UNITS || options.organizationalUnits.some((unit) => unit.id === requestedUnit);
  const authorizedUnit = user?.scope === "DEPARTMENT" && requestedUnit !== ALL_ORGANIZATIONAL_UNITS && requestedUnit !== user.department_id ? false : true;
  return { planYear, organizationalUnitId: validUnit && authorizedUnit ? requestedUnit : defaults.organizationalUnitId };
}
