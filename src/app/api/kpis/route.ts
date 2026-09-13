import { auditMutation, ensureRuntimeData, handleApiError, json, readJson, requirePermission } from "../_lib";
import { KPIRepository } from "../../../server/repositories";
export const dynamic = "force-dynamic";
export async function GET() { try { ensureRuntimeData(); await requirePermission("actions.view"); return json(new KPIRepository().list()); } catch (error) { return handleApiError(error); } }
export async function POST(request: Request) { try { ensureRuntimeData(); const user = await requirePermission("kpis.manage"); const input = await readJson(request); delete input.id; delete input.pulse_identifier; delete input.pulseIdentifier; const result = new KPIRepository().create(input as never); auditMutation(user, "kpi", String((result as { id: string }).id), "created", null, result); return json(result, { status: 201 }); } catch (error) { return handleApiError(error); } }
