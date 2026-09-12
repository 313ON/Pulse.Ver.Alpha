import { ensureRuntimeData, handleApiError, json, requirePermission } from "../../_lib";
import { isDatabaseUnavailableError } from "../../../../server/db";
import { defaultDashboardContext, getDashboardContextOptions, loadDashboardState } from "../../../../server/dashboard";
import { ALL_ORGANIZATIONAL_UNITS } from "../../../../components/program/dashboard-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("goals.view");
    ensureRuntimeData();
    const url = new URL(request.url);
    const defaults = defaultDashboardContext();
    const requestedPlanYear = Number(url.searchParams.get("planYear"));
    const requestedUnit = url.searchParams.get("organizationalUnitId") || defaults.organizationalUnitId;
    const options = getDashboardContextOptions();
    const planYear = options.planYears.includes(requestedPlanYear) ? requestedPlanYear : defaults.planYear;
    const organizationalUnitId = requestedUnit === ALL_ORGANIZATIONAL_UNITS || options.organizationalUnits.some((unit) => unit.id === requestedUnit) ? requestedUnit : defaults.organizationalUnitId;
    if (user.scope === "DEPARTMENT" && organizationalUnitId !== ALL_ORGANIZATIONAL_UNITS && organizationalUnitId !== user.department_id) {
      return json({ error: "دسترسی شما به این واحد سازمانی مجاز نیست.", code: "FORBIDDEN" }, { status: 403 });
    }
    const context = { planYear, organizationalUnitId };
    return json({ state: loadDashboardState(user, context), context, options });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) return json({ state: { kind: "blocking-error", message: "داده پایدار برنامه در دسترس نیست.", guidance: "اتصال پایگاه داده را بررسی کنید یا با مسئول سامانه تماس بگیرید." } }, { status: 503 });
    return handleApiError(error);
  }
}
