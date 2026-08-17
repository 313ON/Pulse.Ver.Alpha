import { ensureRuntimeData, handleApiError, json, readJson } from "../_lib";
import { DepartmentRepository } from "../../../server/repositories";
export const dynamic = "force-dynamic";
export function GET() { try { ensureRuntimeData(); return json(new DepartmentRepository().list()); } catch (error) { return handleApiError(error); } }
export async function POST(request: Request) { try { ensureRuntimeData(); return json(new DepartmentRepository().create(await readJson(request) as never), { status: 201 }); } catch (error) { return handleApiError(error); } }
