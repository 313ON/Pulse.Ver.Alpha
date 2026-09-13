import { auditMutation, ensureRuntimeData, handleApiError, json, readJson, requirePermission } from "../_lib";
import { GoalRepository } from "../../../server/repositories";

export const dynamic = "force-dynamic";
export async function GET() {
  try { ensureRuntimeData(); await requirePermission("goals.view"); return json(new GoalRepository().list()); } catch (error) { return handleApiError(error); }
}
export async function POST(request: Request) { try { ensureRuntimeData(); const user = await requirePermission("goals.edit"); const input = await readJson(request) as Record<string, unknown>; delete input.id; const result = new GoalRepository().create(input as never); auditMutation(user, "goal", String((result as { id: string }).id), "created", null, result); return json(result, { status: 201 }); } catch (error) { return handleApiError(error); } }
