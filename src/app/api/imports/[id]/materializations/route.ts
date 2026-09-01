import { ensureRuntimeData, handleApiError, json, readJson, requireCsrf, requirePermission } from "../../../_lib";
import { MaterializationApplicationService } from "../../../../../application/materialization";
import { DepartmentalMaterializationService } from "../../../../../application/materialization/departmental";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    ensureRuntimeData();
    await requirePermission("imports.materialize.view");
    return json(new MaterializationApplicationService().list((await params).id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    ensureRuntimeData();
    const actor = await requirePermission("imports.materialize.request");
    await requirePermission("imports.materialize.execute");
    await requireCsrf(request);
    const id = (await params).id;
    const body = await readJson(request, { csrf: false });
    if (body.materializationKind === "DEPARTMENTAL") {
      const targetPlanYear = Number(body.targetPlanYear);
      if (!Number.isInteger(targetPlanYear) || targetPlanYear < 1) throw new Error("targetPlanYear must be a positive integer.");
      const result = new DepartmentalMaterializationService().materialize(actor.id, id, targetPlanYear);
      return json({ departmental: result }, { status: result.duplicate ? 200 : 201 });
    }
    const result = new MaterializationApplicationService().request(actor.id, body, id);
    return json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
