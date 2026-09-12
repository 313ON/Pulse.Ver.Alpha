import { ensureRuntimeData, handleApiError, json, requirePermission } from "../../_lib";
import { isDatabaseUnavailableError } from "../../../../server/db";
import { getDashboardContextOptions, loadDashboardState, resolveDashboardContext } from "../../../../server/dashboard";
import { ALL_ORGANIZATIONAL_UNITS } from "../../../../components/program/dashboard-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("goals.view");
    ensureRuntimeData();
    const url = new URL(request.url);
    const options = getDashboardContextOptions();
    const requestedUnit = url.searchParams.get("unit") || url.searchParams.get("organizationalUnitId") || undefined;
    const requestedPlanCycle = url.searchParams.get("planCycle") || url.searchParams.get("planYear") || undefined;
    const requestedUnitIsValid = requestedUnit === ALL_ORGANIZATIONAL_UNITS || options.organizationalUnits.some((unit) => unit.id === requestedUnit);
    if (user.scope === "DEPARTMENT" && requestedUnitIsValid && requestedUnit !== ALL_ORGANIZATIONAL_UNITS && requestedUnit !== user.department_id) {
      return json({ error: "دسترسی شما به این واحد سازمانی مجاز نیست.", code: "FORBIDDEN" }, { status: 403 });
    }
    const context = resolveDashboardContext(options, { planCycle: requestedPlanCycle, unit: requestedUnit }, user);
    return json({ state: loadDashboardState(user, context), context, options });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) return json({ state: { kind: "blocking-error", message: "داده پایدار برنامه در دسترس نیست.", guidance: "اتصال پایگاه داده را بررسی کنید یا با مسئول سامانه تماس بگیرید." } }, { status: 503 });
    return handleApiError(error);
  }
}
