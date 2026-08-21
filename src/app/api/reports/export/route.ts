import { handleApiError, requirePermission } from "../../_lib";
import {
  createGovernedPdfBuffer,
  createGovernedXlsxBuffer,
} from "../../../../server/exporters";
import {
  getCanonicalProgram,
  ProductionGovernedOperationalReportService,
} from "../../../../application/reporting";
import { getPlanningContext } from "../../../../domain/planning";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const format = params.format ?? "xlsx";
    if (params.mode && params.mode !== "governed") {
      return new Response(JSON.stringify({ error: "Legacy non-governed exports are no longer available.", code: "GONE" }), { status: 410, headers: { "Content-Type": "application/json" } });
    }
    const planning = getPlanningContext();
    const user = await requirePermission("reports.export");
    if (!params.generatedAt) {
      return new Response(JSON.stringify({ error: "generatedAt is required for governed reports.", code: "VALIDATION" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const report = new ProductionGovernedOperationalReportService(planning).report(
      getCanonicalProgram(planning),
      user,
      params.generatedAt,
      { goalId: params.goal, status: params.status, assignmentId: params.assignmentId }
    );
    if (format === "pdf") {
      const pdf = await createGovernedPdfBuffer(report);
      return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=pulse-governed-report.pdf" } });
    }
    const output = createGovernedXlsxBuffer(report);
    return new Response(new Uint8Array(output), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=pulse-governed-report.xlsx" } });
  } catch (error) {
    return handleApiError(error);
  }
}
