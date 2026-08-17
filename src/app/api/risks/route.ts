import { ensureRuntimeData, handleApiError, json, readJson } from "../_lib";
import { RiskRepository } from "../../../server/repositories";
export const dynamic = "force-dynamic";
export function GET() { try { ensureRuntimeData(); return json(new RiskRepository().list()); } catch (error) { return handleApiError(error); } }
export async function POST(request: Request) { try { ensureRuntimeData(); return json(new RiskRepository().create(await readJson(request) as never), { status: 201 }); } catch (error) { return handleApiError(error); } }
