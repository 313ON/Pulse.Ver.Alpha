import { auditMutation, ensureRuntimeData, handleApiError, json, readJson, requirePermission } from "../../../_lib";
import { getDatabase } from "../../../../../server/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    ensureRuntimeData();
    await requirePermission("permissions.manage");
    const roleId = (await params).id;
    return json(getDatabase().prepare(`
      SELECT p.id, p.code, p.title, CASE WHEN rp.role_id IS NULL THEN 0 ELSE 1 END AS enabled
      FROM permissions p LEFT JOIN role_permissions rp ON rp.permission_id = p.id AND rp.role_id = ?
      ORDER BY p.code
    `).all(roleId));
  } catch (error) { return handleApiError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    ensureRuntimeData();
    const user = await requirePermission("permissions.manage");
    const roleId = (await params).id;
    const body = await readJson(request);
    const permissionIds = Array.isArray(body.permissionIds) ? body.permissionIds.map(String) : [];
    const db = getDatabase();
    const before = db.prepare("SELECT permission_id FROM role_permissions WHERE role_id = ?").all(roleId);
    const update = db.transaction(() => {
      db.prepare("DELETE FROM role_permissions WHERE role_id = ?").run(roleId);
      const insert = db.prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
      permissionIds.forEach((permissionId) => insert.run(roleId, permissionId));
    });
    update();
    const after = db.prepare("SELECT permission_id FROM role_permissions WHERE role_id = ?").all(roleId);
    auditMutation(user, "role-permissions", roleId, "permissions_changed", before, after);
    return json(after);
  } catch (error) { return handleApiError(error); }
}
