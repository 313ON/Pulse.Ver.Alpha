import { auditMutation, ensureRuntimeData, handleApiError, json, readJson, requirePermission } from "../../_lib";
import { UserRepository } from "../../../../server/repositories";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { ensureRuntimeData(); await requirePermission("users.manage"); const item = new UserRepository().get((await params).id); return item ? json(item) : json({ error: "The user was not found." }, { status: 404 }); } catch (error) { return handleApiError(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { ensureRuntimeData(); const user = await requirePermission("users.manage"); const id = (await params).id; const repo = new UserRepository(); const before = repo.get(id); const result = repo.update(id, await readJson(request) as never); auditMutation(user, "user", id, "updated", before, result); return json(result); } catch (error) { return handleApiError(error); }
}
