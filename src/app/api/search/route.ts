import { ensureRuntimeData, json, requirePermission } from "../_lib";
import { getDatabase } from "../../../server/db";

export async function GET(request: Request) {
  ensureRuntimeData();
  const user = await requirePermission("actions.view");
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return json({ results: [] });
  const like = `%${query}%`;
  const db = getDatabase();
  const results = [
    ...(db.prepare("SELECT id, title AS label, 'هدف' AS type FROM strategic_goals WHERE title LIKE ? LIMIT 10").all(like) as Array<Record<string, unknown>>),
    ...(db.prepare("SELECT id, title AS label, 'زیرهدف' AS type FROM sub_goals WHERE title LIKE ? LIMIT 10").all(like) as Array<Record<string, unknown>>),
    ...(db.prepare("SELECT id, title AS label, 'فعالیت' AS type FROM activities WHERE title LIKE ? LIMIT 10").all(like) as Array<Record<string, unknown>>),
    ...(db.prepare(`SELECT public_id AS id, title AS label, 'اقدام' AS type FROM work_items WHERE title LIKE ? ${user.scope === "DEPARTMENT" ? "AND department_id = ?" : user.scope === "OWN" ? "AND owner_person_id = ?" : ""} LIMIT 20`).all(...(user.scope === "DEPARTMENT" ? [like, user.department_id] : user.scope === "OWN" ? [like, user.person_id] : [like])) as Array<Record<string, unknown>>),
    ...(db.prepare("SELECT id, full_name AS label, 'پرسنل' AS type FROM people WHERE full_name LIKE ? LIMIT 10").all(like) as Array<Record<string, unknown>>),
    ...(db.prepare("SELECT id, name AS label, 'واحد' AS type FROM departments WHERE name LIKE ? LIMIT 10").all(like) as Array<Record<string, unknown>>),
    ...(db.prepare("SELECT id, title AS label, 'سمت' AS type FROM seats WHERE title LIKE ? LIMIT 10").all(like) as Array<Record<string, unknown>>),
    ...(db.prepare("SELECT id, name AS label, 'شاخص' AS type FROM kpis WHERE name LIKE ? LIMIT 10").all(like) as Array<Record<string, unknown>>),
    ...(db.prepare("SELECT id, title AS label, 'ریسک' AS type FROM risks WHERE title LIKE ? LIMIT 10").all(like) as Array<Record<string, unknown>>)
  ];
  return json({ results });
}
