import { auditMutation, ensureRuntimeData, handleApiError, json, readJson, requirePermission } from "../_lib";
import { ActionRepository } from "../../../server/repositories";
export const dynamic = "force-dynamic";
export async function GET() { try { ensureRuntimeData(); const user = await requirePermission("actions.view"); return json(new ActionRepository().list(user)); } catch (error) { return handleApiError(error); } }
export async function POST(request: Request) { try { ensureRuntimeData(); const user = await requirePermission("actions.create"); const body = await readJson(request); const result = new ActionRepository().create(body as never); auditMutation(user, "action", String((result as { public_id: string }).public_id), "created", null, result); return json(result, { status: 201 }); } catch (error) { return handleApiError(error); } }
