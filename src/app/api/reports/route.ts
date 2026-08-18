import { ensureRuntimeData, handleApiError, json, requirePermission } from "../_lib";
import { buildReport } from "../../../server/reporting";

export async function GET(request: Request) {
  try {
    ensureRuntimeData();
    const user = await requirePermission("reports.view");
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    return json(buildReport(params, user));
  } catch (error) {
    return handleApiError(error);
  }
}
