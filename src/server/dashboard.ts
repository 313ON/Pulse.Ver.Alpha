import { getPlanningContext } from "../domain/planning";
import { classifyDashboardData, type DashboardState } from "../components/program/dashboard-state";
import { createProgramServices } from "./program";
import { getDatabase } from "./db";
import type { SessionUser } from "./auth";
import type { DashboardContext, DashboardContextOptions } from "../components/program/dashboard-context";
import { ALL_ORGANIZATIONAL_UNITS } from "../components/program/dashboard-context";

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
  return classifyDashboardData(program, new Date().toISOString(), context);
}

export function defaultDashboardContext(): DashboardContext {
  return { planYear: getPlanningContext().planYear, organizationalUnitId: ALL_ORGANIZATIONAL_UNITS };
}
