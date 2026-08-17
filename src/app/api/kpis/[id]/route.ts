import { ensureRuntimeData, handleApiError, json, readJson } from "../../_lib";
import { KPIRepository } from "../../../../server/repositories";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { try { ensureRuntimeData(); const { id } = await params; const item = new KPIRepository().get(id); return item ? json(item) : json({ error: "The KPI was not found.", code: "NOT_FOUND" }, { status: 404 }); } catch (error) { return handleApiError(error); } }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { ensureRuntimeData(); const { id } = await params; return json(new KPIRepository().update(id, await readJson(request))); } catch (error) { return handleApiError(error); } }
