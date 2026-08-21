import { handleApiError, json, requirePermission } from "../_lib";
import {
  getCanonicalProgram,
  ProductionGovernedOperationalReportService,
} from "../../../application/reporting";
import { getPlanningContext } from "../../../domain/planning";

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    if (params.mode && params.mode !== "governed") {
      return json({ error: "Legacy non-governed reports are no longer available.", code: "GONE" }, { status: 410 });
    }
    const planning = getPlanningContext();
    const user = await requirePermission("reports.view");
    if (!params.generatedAt) {
      return json({ error: "generatedAt is required for governed reports.", code: "VALIDATION" }, { status: 400 });
    }
    return json(new ProductionGovernedOperationalReportService(planning).report(
      getCanonicalProgram(planning),
      user,
      params.generatedAt,
      { goalId: params.goal, status: params.status, assignmentId: params.assignmentId }
    ));
  } catch (error) {
    return handleApiError(error);
  }
}
