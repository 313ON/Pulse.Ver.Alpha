import { ensureRuntimeData, handleApiError, json, readJson, requireCsrf, requirePermission } from "../../../_lib";
import { MaterializationApplicationService } from "../../../../../application/materialization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ operationId: string }> }) {
  try {
    ensureRuntimeData();
    const actor = await requirePermission("imports.materialize.retry");
    await requireCsrf(request);
    const result = new MaterializationApplicationService().retry(
      actor.id, (await params).operationId, await readJson(request, { csrf: false })
    );
    return json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
