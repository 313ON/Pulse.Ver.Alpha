import { ensureRuntimeData, handleApiError, requirePermission } from "../../_lib";
import { buildReport } from "../../../../server/reporting";
import {
  createGovernedPdfBuffer,
  createGovernedXlsxBuffer,
  createPdfBuffer,
  createXlsxBuffer
} from "../../../../server/exporters";
import {
  ProductionGovernedOperationalReportService,
  ReadOnlyProgramQueryService
} from "../../../../application/reporting";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const format = params.format ?? "xlsx";
    if (params.mode === "governed") {
      const user = await requirePermission("reports.export");
      if (!params.generatedAt) {
        return new Response(JSON.stringify({ error: "generatedAt is required for governed reports.", code: "VALIDATION" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const program = new ReadOnlyProgramQueryService().getProgram({
        id: "program-1405",
        title: "برنامه سالانه تحول دیجیتال ۱۴۰۵",
        description: "گزارش برنامه canonical سال ۱۴۰۵",
        status: "در حال اجرا",
        priority: "بحرانی",
        start: "۱۴۰۵/۰۱/۰۱",
        end: "۱۴۰۵/۱۲/۲۹"
      }).hierarchy;
      const report = new ProductionGovernedOperationalReportService().report(
        program,
        user,
        params.generatedAt,
        {
          goalId: params.goal,
          status: params.status,
          assignmentId: params.assignmentId
        }
      );
      if (format === "pdf") {
        const pdf = await createGovernedPdfBuffer(report);
        return new Response(new Uint8Array(pdf), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": "attachment; filename=pulse-governed-report.pdf"
          }
        });
      }
      const output = createGovernedXlsxBuffer(report);
      return new Response(new Uint8Array(output), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": "attachment; filename=pulse-governed-report.xlsx"
        }
      });
    }
    ensureRuntimeData();
    const user = await requirePermission("reports.export");
    const report = buildReport(params, user);
    if (format === "pdf") {
      const pdf = await createPdfBuffer(report);
      return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=pulse-annual-report.pdf" } });
    }
    const output = createXlsxBuffer(report);
    return new Response(new Uint8Array(output), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=pulse-annual-report.xlsx" } });
  } catch (error) {
    return handleApiError(error);
  }
}
