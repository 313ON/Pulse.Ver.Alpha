import { ensureRuntimeData, handleApiError, json, readJson } from "../../_lib";
import { RoleRepository } from "../../../../server/repositories";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { try { ensureRuntimeData(); const { id } = await params; const item = new RoleRepository().get(id); return item ? json(item) : json({ error: "The role was not found.", code: "NOT_FOUND" }, { status: 404 }); } catch (error) { return handleApiError(error); } }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { ensureRuntimeData(); const { id } = await params; return json(new RoleRepository().update(id, await readJson(request) as never)); } catch (error) { return handleApiError(error); } }
