import { ensureRuntimeData, handleApiError, requirePermission } from "../../_lib";
import { buildReport } from "../../../../server/reporting";
import { createPdfBuffer, createXlsxBuffer } from "../../../../server/exporters";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    ensureRuntimeData();
    const user = await requirePermission("reports.export");
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const format = params.format ?? "xlsx";
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
