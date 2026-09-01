import { ensureRuntimeData, handleApiError, json, requirePermission } from "../../../_lib";
import { getPlanningContext } from "../../../../../domain/planning";
import { MaterializationApplicationService } from "../../../../../application/materialization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    ensureRuntimeData();
    await requirePermission("imports.materialize.view");
    const { id } = await params;
    return json(new MaterializationApplicationService().readiness(id, getPlanningContext().planYear));
  } catch (error) {
    return handleApiError(error);
  }
}
