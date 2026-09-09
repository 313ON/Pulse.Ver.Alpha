import { PulseShell } from "../components/PulseShell";
import { StrategicCommandCenter } from "../components/program/StrategicCommandCenter";
import { ensureRuntimeData } from "./api/_lib";
import { requirePagePermission } from "./api/_lib";
import { createProgramServices } from "../server/program";
import { getPlanningContext } from "../domain/planning";
import { classifyDashboardData, type DashboardState } from "../components/program/dashboard-state";
import { isDatabaseUnavailableError } from "../server/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requirePagePermission("goals.view");
  const planning = getPlanningContext();
  let state: DashboardState;
  try {
    ensureRuntimeData();
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
    state = classifyDashboardData(program);
  } catch (error) {
    state = isDatabaseUnavailableError(error)
      ? { kind: "blocking-error", message: "داده پایدار برنامه در دسترس نیست.", guidance: "اتصال پایگاه داده را بررسی کنید یا با مسئول سامانه تماس بگیرید." }
      : { kind: "recoverable-error", message: "دریافت داده‌های داشبورد با مشکل روبه‌رو شد." };
  }
  return <PulseShell><StrategicCommandCenter state={state} today={planning.today} /></PulseShell>;
}
