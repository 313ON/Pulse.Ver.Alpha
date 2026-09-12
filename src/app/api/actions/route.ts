import { auditMutation, ensureRuntimeData, handleApiError, json, readJson, requirePermission } from "../_lib";
import { ActionRepository } from "../../../server/repositories";
import { getDashboardContextOptions, resolveDashboardContext } from "../../../server/dashboard";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { ensureRuntimeData(); const user = await requirePermission("actions.view"); const url = new URL(request.url); const context = resolveDashboardContext(getDashboardContextOptions(), { planCycle: url.searchParams.get("planCycle") ?? undefined, unit: url.searchParams.get("unit") ?? undefined }, user); return json(new ActionRepository().list(user, context)); } catch (error) { return handleApiError(error); } }
export async function POST(request: Request) { try { ensureRuntimeData(); const user = await requirePermission("actions.create"); const body = await readJson(request); const result = new ActionRepository().create(body as never); auditMutation(user, "action", String((result as { public_id: string }).public_id), "created", null, result); return json(result, { status: 201 }); } catch (error) { return handleApiError(error); } }
