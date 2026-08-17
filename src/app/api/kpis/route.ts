import { ensureRuntimeData, handleApiError, json, readJson } from "../_lib";
import { KPIRepository } from "../../../server/repositories";
export const dynamic = "force-dynamic";
export function GET() { try { ensureRuntimeData(); return json(new KPIRepository().list()); } catch (error) { return handleApiError(error); } }
export async function POST(request: Request) { try { ensureRuntimeData(); return json(new KPIRepository().create(await readJson(request) as never), { status: 201 }); } catch (error) { return handleApiError(error); } }
