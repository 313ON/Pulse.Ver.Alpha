import { ensureRuntimeData, handleApiError, json, readJson } from "../../_lib";
import { GoalRepository } from "../../../../server/repositories";

export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { ensureRuntimeData(); const { id } = await params; const item = new GoalRepository().get(id); return item ? json(item) : json({ error: "The goal was not found.", code: "NOT_FOUND" }, { status: 404 }); } catch (error) { return handleApiError(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { ensureRuntimeData(); const { id } = await params; return json(new GoalRepository().update(id, await readJson(request) as never)); } catch (error) { return handleApiError(error); } }
