import { ensureRuntimeData, handleApiError, json, readJson } from "../_lib";
import { ActionRepository } from "../../../server/repositories";
export const dynamic = "force-dynamic";
export function GET() { try { ensureRuntimeData(); return json(new ActionRepository().list()); } catch (error) { return handleApiError(error); } }
export async function POST(request: Request) { try { ensureRuntimeData(); const body = await readJson(request); return json(new ActionRepository().create(body as never), { status: 201 }); } catch (error) { return handleApiError(error); } }
