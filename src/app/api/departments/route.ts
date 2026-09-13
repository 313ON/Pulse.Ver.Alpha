import { auditMutation, ensureRuntimeData, handleApiError, json, readJson, requirePermission } from "../_lib";
import { DepartmentRepository } from "../../../server/repositories";
export const dynamic = "force-dynamic";
export async function GET() { try { ensureRuntimeData(); await requirePermission("organization.manage"); return json(new DepartmentRepository().list()); } catch (error) { return handleApiError(error); } }
export async function POST(request: Request) { try { ensureRuntimeData(); const user = await requirePermission("organization.manage"); const input = await readJson(request); delete input.id; delete input.pulse_identifier; delete input.pulseIdentifier; const result = new DepartmentRepository().create(input as never); auditMutation(user, "department", String((result as { id: string }).id), "created", null, result); return json(result, { status: 201 }); } catch (error) { return handleApiError(error); } }
