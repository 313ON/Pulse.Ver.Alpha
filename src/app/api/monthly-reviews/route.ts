import { auditMutation, ensureRuntimeData, handleApiError, json, readJson, requirePermission } from "../_lib";
import { MonthlyReviewRepository } from "../../../server/repositories";
export const dynamic = "force-dynamic";
export async function GET() { try { ensureRuntimeData(); await requirePermission("reports.view"); return json(new MonthlyReviewRepository().list()); } catch (error) { return handleApiError(error); } }
export async function POST(request: Request) { try { ensureRuntimeData(); const user = await requirePermission("reports.view"); const input = await readJson(request); delete input.id; delete input.pulse_identifier; delete input.pulseIdentifier; const result = new MonthlyReviewRepository().create(input); auditMutation(user, "monthly-review", String((result as { id: string }).id), "created", null, result); return json(result, { status: 201 }); } catch (error) { return handleApiError(error); } }
