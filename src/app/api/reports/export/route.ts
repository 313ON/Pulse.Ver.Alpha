import { handleApiError, requirePermission } from "../../_lib";
import {
  createGovernedPdfBuffer,
  createGovernedXlsxBuffer,
} from "../../../../server/exporters";
import {
  getCanonicalProgram,
  ProductionGovernedOperationalReportService,
  governedGoalOptions,
} from "../../../../application/reporting";
import { createPlanningContext } from "../../../../domain/planning";
import { getDashboardContextOptions, resolveDashboardContext } from "../../../../server/dashboard";
import { ALL_ORGANIZATIONAL_UNITS } from "../../../../components/program/dashboard-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const format = params.format ?? "xlsx";
    if (params.mode && params.mode !== "governed") {
      return new Response(JSON.stringify({ error: "Legacy non-governed exports are no longer available.", code: "GONE" }), { status: 410, headers: { "Content-Type": "application/json" } });
    }
    const user = await requirePermission("reports.export");
    if (!params.generatedAt) {
      return new Response(JSON.stringify({ error: "generatedAt is required for governed reports.", code: "VALIDATION" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const options = getDashboardContextOptions();
    const requestedUnit = params.unit;
    const requestedPlanCycle = params.planCycle;
    const validUnit = requestedUnit === ALL_ORGANIZATIONAL_UNITS || options.organizationalUnits.some((unit) => unit.id === requestedUnit);
    if (user.scope === "DEPARTMENT" && validUnit && requestedUnit && requestedUnit !== ALL_ORGANIZATIONAL_UNITS && requestedUnit !== user.department_id) {
      return new Response(JSON.stringify({ error: "دسترسی شما به این واحد سازمانی مجاز نیست.", code: "FORBIDDEN" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }
    const context = resolveDashboardContext(options, { planCycle: requestedPlanCycle, unit: requestedUnit }, user);
    const reportPlanning = createPlanningContext({ planYear: context.planYear });
    const program = getCanonicalProgram(reportPlanning, context.organizationalUnitId === ALL_ORGANIZATIONAL_UNITS ? undefined : context.organizationalUnitId);
    const service = new ProductionGovernedOperationalReportService(reportPlanning);
    const baseFilters = { status: params.status, assignmentId: params.assignmentId };
    const baseReport = service.report(program, user, params.generatedAt, baseFilters);
    const availableGoals = governedGoalOptions(baseReport, program);
    if (params.goal && !availableGoals.some((goal) => goal.id === params.goal)) {
      return new Response(JSON.stringify({ error: "The selected goal is not available in the governed report scope.", code: "VALIDATION" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const report = params.goal ? service.report(program, user, params.generatedAt, { ...baseFilters, goalId: params.goal }) : baseReport;
    if (format === "pdf") {
      const pdf = await createGovernedPdfBuffer(report);
      return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=pulse-governed-report.pdf" } });
    }
    const output = await createGovernedXlsxBuffer(report);
    return new Response(new Uint8Array(output), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=pulse-governed-report.xlsx" } });
  } catch (error) {
    return handleApiError(error);
  }
}
