import { ensureRuntimeData, handleApiError, json, requirePermission } from "../_lib";
import { buildReport } from "../../../server/reporting";
import {
  ProductionGovernedOperationalReportService,
  ReadOnlyProgramQueryService
} from "../../../application/reporting";
import { SQLiteOperationalProgramReadRepository } from "../../../server/reporting/OperationalProgramReadRepository";

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    if (params.mode === "governed") {
      const user = await requirePermission("reports.view");
      if (!params.generatedAt) {
        return json({ error: "generatedAt is required for governed reports.", code: "VALIDATION" }, { status: 400 });
      }
      const program = new ReadOnlyProgramQueryService(new SQLiteOperationalProgramReadRepository()).getProgram({
        id: "program-1405",
        title: "برنامه سالانه تحول دیجیتال ۱۴۰۵",
        description: "گزارش برنامه canonical سال ۱۴۰۵",
        status: "در حال اجرا",
        priority: "بحرانی",
        start: "۱۴۰۵/۰۱/۰۱",
        end: "۱۴۰۵/۱۲/۲۹"
      }).hierarchy;
      return json(new ProductionGovernedOperationalReportService().report(
        program,
        user,
        params.generatedAt,
        {
          goalId: params.goal,
          status: params.status,
          assignmentId: params.assignmentId
        }
      ));
    }
    ensureRuntimeData();
    const user = await requirePermission("reports.view");
    return json(buildReport(params, user));
  } catch (error) {
    return handleApiError(error);
  }
}
