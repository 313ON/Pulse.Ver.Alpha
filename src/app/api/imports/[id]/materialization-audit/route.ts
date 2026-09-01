import { ensureRuntimeData, handleApiError, json, requirePermission } from "../../../_lib";
import { MaterializationApplicationService } from "../../../../../application/materialization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    ensureRuntimeData();
    await requirePermission("imports.materialize.view");
    return json(new MaterializationApplicationService().audit((await params).id));
  } catch (error) {
    return handleApiError(error);
  }
}
