import { getDatabase } from "./db";
import type { SessionUser } from "./auth";

export type ReportFilters = Record<string, string>;

export function buildReport(filters: ReportFilters, user?: SessionUser | null) {
  const db = getDatabase();
  const clauses = ["w.plan_year = 1405"];
  const values: Record<string, string | number> = {};
  const add = (sql: string, key: string, value: string | null) => {
    if (value) { clauses.push(sql); values[key] = value; }
  };
  add("w.goal_id = @goal", "goal", filters.goal);
  add("w.sub_goal_id = @subGoal", "subGoal", filters.subGoal);
  add("w.activity_id = @activity", "activity", filters.activity);
  add("w.public_id = @action", "action", filters.action);
  add("w.department_id = @department", "department", filters.department);
  add("w.role_id = @role", "role", filters.role);
  add("w.owner_person_id = @person", "person", filters.person ?? filters.owner);
  add("w.status = @status", "status", filters.status);
  if (filters.dateFrom) add("w.planned_start >= @dateFrom", "dateFrom", filters.dateFrom);
  if (filters.dateTo) add("w.planned_end <= @dateTo", "dateTo", filters.dateTo);
  if (filters.progressMin) { clauses.push("w.progress >= @progressMin"); values.progressMin = Number(filters.progressMin); }
  if (filters.progressMax) { clauses.push("w.progress <= @progressMax"); values.progressMax = Number(filters.progressMax); }
  if (filters.overdue === "true") clauses.push("w.status NOT IN ('تکمیل شده','لغو شده') AND w.planned_end < '۱۴۰۵/۰۶/۱۵'");
  if (filters.kpi === "true") clauses.push("EXISTS (SELECT 1 FROM kpis k WHERE k.work_item_id = w.id)");
  if (filters.risk === "true") clauses.push("EXISTS (SELECT 1 FROM risks r WHERE r.work_item_id = w.id OR r.goal_id = w.goal_id)");
  if (user?.scope === "DEPARTMENT") { clauses.push("w.department_id = @scopeDepartment"); values.scopeDepartment = user.department_id ?? ""; }
  if (user?.scope === "OWN") { clauses.push("w.owner_person_id = @scopePerson"); values.scopePerson = user.person_id ?? ""; }
  const actions = db.prepare(`
    SELECT w.id, w.public_id, w.title, w.description, w.goal_id, w.sub_goal_id, w.activity_id,
      w.department_id, w.role_id, w.owner_person_id, w.status, w.progress, w.planned_start,
      w.planned_end, w.deliverable, d.name AS department, p.full_name AS owner,
      g.title AS goal_title, sg.title AS sub_goal_title, a.title AS activity_title
    FROM work_items w
    JOIN strategic_goals g ON g.id = w.goal_id
    LEFT JOIN sub_goals sg ON sg.id = w.sub_goal_id
    LEFT JOIN activities a ON a.id = w.activity_id
    JOIN departments d ON d.id = w.department_id
    JOIN people p ON p.id = w.owner_person_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY w.planned_end, w.public_id
  `).all(values) as Array<Record<string, unknown>>;
  const departments = db.prepare("SELECT d.id, d.name, COUNT(w.id) AS action_count, COALESCE(ROUND(AVG(w.progress)),0) AS progress FROM departments d LEFT JOIN work_items w ON w.department_id = d.id AND w.plan_year = 1405 GROUP BY d.id ORDER BY d.name").all();
  const goals = db.prepare("SELECT g.id, g.title, COUNT(w.id) AS action_count, COALESCE(ROUND(AVG(w.progress)),0) AS progress FROM strategic_goals g LEFT JOIN work_items w ON w.goal_id = g.id AND w.plan_year = 1405 GROUP BY g.id ORDER BY g.id").all();
  const monthlyTrend = db.prepare("SELECT substr(w.planned_end, 1, 7) AS month, COUNT(*) AS actions, COALESCE(ROUND(AVG(w.progress)),0) AS progress FROM work_items w WHERE w.plan_year = 1405 GROUP BY month ORDER BY month").all();
  const highRisks = db.prepare("SELECT COUNT(*) AS count FROM risks WHERE probability * impact >= 15 AND status <> 'بسته'").get() as { count: number };
  const unresolvedDependencies = db.prepare("SELECT COUNT(*) AS count FROM dependencies WHERE status <> 'حل‌شده' OR delay_days > 0").get() as { count: number };
  const completed = actions.filter((row) => row.status === "تکمیل شده").length;
  return {
    title: "گزارش وضعیت برنامه سالانه",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalGoals: (db.prepare("SELECT COUNT(*) AS count FROM strategic_goals WHERE plan_year = 1405").get() as { count: number }).count,
      totalActions: actions.length,
      completionPercentage: actions.length ? Math.round((completed / actions.length) * 100) : 0,
      overdueActions: actions.filter((row) => row.status !== "تکمیل شده" && row.status !== "لغو شده" && String(row.planned_end) < "۱۴۰۵/۰۶/۱۵").length,
      highRisks: highRisks.count,
      unresolvedDependencies: unresolvedDependencies.count,
      averageProgress: actions.length ? Math.round(actions.reduce((sum, row) => sum + Number(row.progress), 0) / actions.length) : 0
    },
    departments,
    goals,
    monthlyTrend,
    actions
  };
}
