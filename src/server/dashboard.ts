import { getPlanningContext } from "../domain/planning";
import { classifyDashboardData, type DashboardState } from "../components/program/dashboard-state";
import { createProgramServices } from "./program";

export function loadDashboardState(): DashboardState {
  const planning = getPlanningContext();
  const { query } = createProgramServices();
  const program = query.getProgram({
    id: `program-${planning.planYear}`,
    title: `برنامه سالانه تحول دیجیتال سازمان در چرخه ${planning.planYear}`,
    description: `نقشه اجرایی یکپارچه تحول دیجیتال سازمان در چرخه برنامه‌ریزی سالانه ${planning.planYear}`,
    status: "در حال اجرا",
    priority: "بحرانی",
    start: planning.startDate,
    end: planning.endDate
  }).hierarchy;
  return classifyDashboardData(program, new Date().toISOString());
}
