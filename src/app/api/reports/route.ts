import { handleApiError, json, requirePermission } from "../_lib";
import {
  getCanonicalProgram,
  ProductionGovernedOperationalReportService,
} from "../../../application/reporting";
import { createPlanningContext } from "../../../domain/planning";
import { getDashboardContextOptions, resolveDashboardContext } from "../../../server/dashboard";
import { ALL_ORGANIZATIONAL_UNITS } from "../../../components/program/dashboard-context";

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    if (params.mode && params.mode !== "governed") {
      return json({ error: "Legacy non-governed reports are no longer available.", code: "GONE" }, { status: 410 });
    }
    const user = await requirePermission("reports.view");
    if (!params.generatedAt) {
      return json({ error: "generatedAt is required for governed reports.", code: "VALIDATION" }, { status: 400 });
    }
    const options = getDashboardContextOptions();
    const requestedUnit = params.unit;
    const requestedPlanCycle = params.planCycle;
    const validUnit = requestedUnit === ALL_ORGANIZATIONAL_UNITS || options.organizationalUnits.some((unit) => unit.id === requestedUnit);
    if (user.scope === "DEPARTMENT" && validUnit && requestedUnit && requestedUnit !== ALL_ORGANIZATIONAL_UNITS && requestedUnit !== user.department_id) {
      return json({ error: "دسترسی شما به این واحد سازمانی مجاز نیست.", code: "FORBIDDEN" }, { status: 403 });
    }
    const context = resolveDashboardContext(options, { planCycle: requestedPlanCycle, unit: requestedUnit }, user);
    const reportPlanning = createPlanningContext({ planYear: context.planYear });
    return json(new ProductionGovernedOperationalReportService(reportPlanning).report(
      getCanonicalProgram(reportPlanning, context.organizationalUnitId === ALL_ORGANIZATIONAL_UNITS ? undefined : context.organizationalUnitId),
      user,
      params.generatedAt,
      { goalId: params.goal, status: params.status, assignmentId: params.assignmentId }
    ));
  } catch (error) {
    return handleApiError(error);
  }
}
