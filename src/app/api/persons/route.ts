import { ensureRuntimeData, handleApiError, json, readJson } from "../_lib";
import { PersonRepository } from "../../../server/repositories";
export const dynamic = "force-dynamic";
export function GET() { try { ensureRuntimeData(); return json(new PersonRepository().list()); } catch (error) { return handleApiError(error); } }
export async function POST(request: Request) { try { ensureRuntimeData(); return json(new PersonRepository().create(await readJson(request) as never), { status: 201 }); } catch (error) { return handleApiError(error); } }
