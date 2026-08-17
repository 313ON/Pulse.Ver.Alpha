import { ensureRuntimeData, handleApiError, json, readJson } from "../_lib";
import { RoleRepository } from "../../../server/repositories";
export const dynamic = "force-dynamic";
export function GET() { try { ensureRuntimeData(); return json(new RoleRepository().list()); } catch (error) { return handleApiError(error); } }
export async function POST(request: Request) { try { ensureRuntimeData(); return json(new RoleRepository().create(await readJson(request) as never), { status: 201 }); } catch (error) { return handleApiError(error); } }
