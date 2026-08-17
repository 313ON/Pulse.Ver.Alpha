import { ensureRuntimeData, handleApiError, json, readJson } from "../../_lib";
import { MonthlyReviewRepository } from "../../../../server/repositories";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { try { ensureRuntimeData(); const { id } = await params; const item = new MonthlyReviewRepository().get(id); return item ? json(item) : json({ error: "The monthly review was not found.", code: "NOT_FOUND" }, { status: 404 }); } catch (error) { return handleApiError(error); } }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { ensureRuntimeData(); const { id } = await params; return json(new MonthlyReviewRepository().update(id, await readJson(request))); } catch (error) { return handleApiError(error); } }
