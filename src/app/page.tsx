import { PulseShell } from "../components/PulseShell";
import { ensureRuntimeData } from "./api/_lib";
import { requirePagePermission } from "./api/_lib";
import { getPlanningContext } from "../domain/planning";
import { type DashboardState } from "../components/program/dashboard-state";
import { isDatabaseUnavailableError } from "../server/db";
import { loadDashboardState } from "../server/dashboard";
import { DashboardController } from "../components/program/DashboardController";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requirePagePermission("goals.view");
  const planning = getPlanningContext();
  let state: DashboardState;
  try {
    ensureRuntimeData();
    state = loadDashboardState();
  } catch (error) {
    state = isDatabaseUnavailableError(error)
      ? { kind: "blocking-error", message: "داده پایدار برنامه در دسترس نیست.", guidance: "اتصال پایگاه داده را بررسی کنید یا با مسئول سامانه تماس بگیرید." }
      : { kind: "recoverable-error", message: "دریافت داده‌های داشبورد با مشکل روبه‌رو شد." };
  }
  return <PulseShell><DashboardController initialState={state} today={planning.today} /></PulseShell>;
}
