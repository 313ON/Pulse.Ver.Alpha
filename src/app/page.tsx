import { PulseShell } from "../components/PulseShell";
import { ensureRuntimeData } from "./api/_lib";
import { requirePagePermission } from "./api/_lib";
import { getPlanningContext } from "../domain/planning";
import { type DashboardState } from "../components/program/dashboard-state";
import { isDatabaseUnavailableError } from "../server/db";
import { getDashboardContextOptions, loadDashboardState, resolveDashboardContext } from "../server/dashboard";
import { DashboardController } from "../components/program/DashboardController";
import type { DashboardContextOptions } from "../components/program/dashboard-context";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission("goals.view");
  const planning = getPlanningContext();
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  let contextOptions: DashboardContextOptions;
  let context = resolveDashboardContext({ planYears: [planning.planYear], organizationalUnits: [] }, {});
  let state: DashboardState = { kind: "recoverable-error", message: "دریافت داده‌های داشبورد با مشکل روبه‌رو شد." };
  let canonicalUrl: string | undefined;
  try {
    ensureRuntimeData();
    contextOptions = getDashboardContextOptions();
    context = resolveDashboardContext(contextOptions, { planCycle: first(params.planCycle), unit: first(params.unit) }, user);
    if ((first(params.planCycle) || first(params.unit)) && (first(params.planCycle) !== String(context.planYear) || first(params.unit) !== context.organizationalUnitId)) {
      canonicalUrl = `/?planCycle=${encodeURIComponent(context.planYear)}&unit=${encodeURIComponent(context.organizationalUnitId)}`;
    } else {
      state = loadDashboardState(user, context);
    }
  } catch (error) {
    state = isDatabaseUnavailableError(error)
      ? { kind: "blocking-error", message: "داده پایدار برنامه در دسترس نیست.", guidance: "اتصال پایگاه داده را بررسی کنید یا با مسئول سامانه تماس بگیرید." }
      : { kind: "recoverable-error", message: "دریافت داده‌های داشبورد با مشکل روبه‌رو شد." };
  }
  if (canonicalUrl) {
    redirect(canonicalUrl);
    return null;
  }
  contextOptions ??= { planYears: [context.planYear], organizationalUnits: [] };
  return <PulseShell><DashboardController initialState={state} today={planning.today} initialContext={context} contextOptions={contextOptions} /></PulseShell>;
}
