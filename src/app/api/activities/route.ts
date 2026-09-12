import { auditMutation, ensureRuntimeData, handleApiError, json, readJson, requirePermission } from "../_lib";
import { canScope } from "../../../server/auth";
import { ActivityRepository } from "../../../server/repositories";
import { getDashboardContextOptions, resolveDashboardContext } from "../../../server/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    ensureRuntimeData();
    const user = await requirePermission("activities.view");
    const url = new URL(request.url);
    const context = resolveDashboardContext(getDashboardContextOptions(), { planCycle: url.searchParams.get("planCycle") ?? undefined, unit: url.searchParams.get("unit") ?? undefined }, user);
    return json(new ActivityRepository().list(user, context));
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    ensureRuntimeData();
    const user = await requirePermission("activities.create");
    const body = await readJson(request);
    const repo = new ActivityRepository();
    const scope = repo.scopeForInput({ ownerPersonId: typeof body.ownerPersonId === "string" ? body.ownerPersonId : undefined });
    if (!canScope(user, scope)) return json({ error: "دسترسی شما به این رکورد مجاز نیست.", code: "FORBIDDEN" }, { status: 403 });
    const result = repo.create(body as never);
    auditMutation(user, "activity", String((result as { id: string }).id), "created", null, result);
    return json(result, { status: 201 });
  } catch (error) { return handleApiError(error); }
}
