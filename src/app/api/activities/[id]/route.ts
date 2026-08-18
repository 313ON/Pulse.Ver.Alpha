import { auditMutation, ensureRuntimeData, handleApiError, json, readJson, requireAccess, requirePermission } from "../../_lib";
import { canScope } from "../../../../server/auth";
import { ActivityRepository } from "../../../../server/repositories";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    ensureRuntimeData();
    const user = await requirePermission("activities.view");
    const item = new ActivityRepository().get((await params).id, user);
    return item ? json(item) : json({ error: "The activity was not found.", code: "NOT_FOUND" }, { status: 404 });
  } catch (error) { return handleApiError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    ensureRuntimeData();
    const id = (await params).id;
    const repo = new ActivityRepository();
    const before = repo.getUnscoped(id) as Record<string, unknown> | undefined;
    if (!before) return json({ error: "The activity was not found.", code: "NOT_FOUND" }, { status: 404 });
    const user = await requirePermission("activities.view");
    const permission = user.scope === "OWN" ? "activities.edit-own" : "activities.edit-department";
    const authorized = await requireAccess(permission, { ownerPersonId: String(before.owner_person_id ?? ""), departmentId: String(before.department_id ?? "") });
    const changes = await readJson(request);
    const nextScope = repo.scopeForInput({ ownerPersonId: typeof changes.ownerPersonId === "string" ? changes.ownerPersonId : String(before.owner_person_id ?? "") });
    if (!canScope(user, nextScope)) return json({ error: "دسترسی شما به این رکورد مجاز نیست.", code: "FORBIDDEN" }, { status: 403 });
    const result = repo.update(id, changes as never);
    auditMutation(authorized, "activity", id, "updated", before, result);
    return json(result);
  } catch (error) { return handleApiError(error); }
}
