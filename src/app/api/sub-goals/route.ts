import { auditMutation, ensureRuntimeData, handleApiError, json, readJson, requirePermission } from "../_lib";
import { SubGoalRepository } from "../../../server/repositories";
export const dynamic = "force-dynamic";
export async function GET() { try { ensureRuntimeData(); await requirePermission("goals.view"); return json(new SubGoalRepository().list()); } catch (error) { return handleApiError(error); } }
export async function POST(request: Request) { try { ensureRuntimeData(); const user = await requirePermission("goals.edit"); const input = await readJson(request); delete input.pulse_identifier; delete input.pulseIdentifier; const result = new SubGoalRepository().create(input as never); auditMutation(user, "sub-goal", String((result as { id: string }).id), "created", null, result); return json(result, { status: 201 }); } catch (error) { return handleApiError(error); } }
