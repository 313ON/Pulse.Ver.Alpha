import { auditMutation, ensureRuntimeData, handleApiError, json, readJson, requirePermission } from "../_lib";
import { UserRepository } from "../../../server/repositories";

export async function GET() {
  try { ensureRuntimeData(); await requirePermission("users.manage"); return json(new UserRepository().list()); } catch (error) { return handleApiError(error); }
}
export async function POST(request: Request) {
  try { ensureRuntimeData(); const user = await requirePermission("users.manage"); const result = new UserRepository().create(await readJson(request) as never); auditMutation(user, "user", String((result as { id: string }).id), "created", null, result); return json(result, { status: 201 }); } catch (error) { return handleApiError(error); }
}
