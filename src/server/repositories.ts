import { randomUUID } from "node:crypto";
import { getDatabase } from "./db";
import { inspectProgramQuality, validateWorkItem, type Dependency, type KpiRecord, type RiskRecord, type WorkItem } from "../lib/domain";
import type { SessionUser } from "./auth";
import { hashPasswordForStorage } from "./auth";

export class RepositoryError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE" | "VALIDATION" | "DATABASE", message: string) {
    super(message);
  }
}

function mapDatabaseError(error: unknown): never {
  const message = error instanceof Error ? error.message : "Database operation failed";
  if (message.includes("UNIQUE")) throw new RepositoryError("DUPLICATE", "The record already exists.");
  if (message.includes("FOREIGN KEY")) throw new RepositoryError("VALIDATION", "The related record does not exist.");
  throw new RepositoryError("DATABASE", "The database operation failed.");
}

export class GoalRepository {
  list() { return getDatabase().prepare("SELECT * FROM strategic_goals WHERE plan_year = 1405 ORDER BY id").all(); }
  get(id: string) { return getDatabase().prepare("SELECT * FROM strategic_goals WHERE id = ?").get(id); }
  create(input: { id: string; title: string }) {
    if (!/^G\d{2}$/.test(input.id) || !input.title.trim()) throw new RepositoryError("VALIDATION", "Goal ID and title are required.");
    try { getDatabase().prepare("INSERT INTO strategic_goals (id, title, plan_year) VALUES (@id,@title,1405)").run(input); return this.get(input.id); } catch (error) { return mapDatabaseError(error); }
  }
  update(id: string, input: { title?: string }) {
    if (!this.get(id)) throw new RepositoryError("NOT_FOUND", "The goal was not found.");
    try { getDatabase().prepare("UPDATE strategic_goals SET title=COALESCE(@title,title) WHERE id=@id").run({ id, title: input.title }); return this.get(id); } catch (error) { return mapDatabaseError(error); }
  }
}

export class DepartmentRepository {
  list() { return getDatabase().prepare("SELECT * FROM departments WHERE active = 1 ORDER BY name").all(); }
  get(id: string) { return getDatabase().prepare("SELECT * FROM departments WHERE id = ?").get(id); }
  create(input: { id: string; name: string }) {
    if (!input.id.trim() || !input.name.trim()) throw new RepositoryError("VALIDATION", "Department ID and name are required.");
    try { getDatabase().prepare("INSERT INTO departments (id, name) VALUES (@id,@name)").run(input); return this.get(input.id); } catch (error) { return mapDatabaseError(error); }
  }
  update(id: string, input: { name?: string; active?: boolean }) {
    if (!this.get(id)) throw new RepositoryError("NOT_FOUND", "The department was not found.");
    try { getDatabase().prepare("UPDATE departments SET name=COALESCE(@name,name), active=COALESCE(@active,active) WHERE id=@id").run({ id, name: input.name, active: input.active === undefined ? undefined : input.active ? 1 : 0 }); return this.get(id); } catch (error) { return mapDatabaseError(error); }
  }
}

export class SubGoalRepository {
  list() { return getDatabase().prepare("SELECT * FROM sub_goals ORDER BY goal_id, title").all(); }
  get(id: string) { return getDatabase().prepare("SELECT * FROM sub_goals WHERE id = ?").get(id); }
  create(input: { id: string; goalId: string; title: string; ownerPersonId?: string }) {
    if (!input.id.trim() || !input.goalId.trim() || !input.title.trim()) throw new RepositoryError("VALIDATION", "Sub-goal ID, goal, and title are required.");
    try { getDatabase().prepare("INSERT INTO sub_goals (id, goal_id, title, owner_person_id) VALUES (@id,@goalId,@title,@ownerPersonId)").run(input); return this.get(input.id); } catch (error) { return mapDatabaseError(error); }
  }
  update(id: string, input: { title?: string; ownerPersonId?: string }) {
    if (!this.get(id)) throw new RepositoryError("NOT_FOUND", "The sub-goal was not found.");
    try { getDatabase().prepare("UPDATE sub_goals SET title=COALESCE(@title,title), owner_person_id=COALESCE(@ownerPersonId,owner_person_id) WHERE id=@id").run({ id, ...input }); return this.get(id); } catch (error) { return mapDatabaseError(error); }
  }
}

export type ActivityRecord = {
  id?: string;
  subGoalId: string;
  title: string;
  description?: string;
  ownerPersonId?: string;
};

export class ActivityRepository {
  private query(extra = "") {
    return `
      SELECT a.*, sg.goal_id, p.full_name AS owner,
        (SELECT COUNT(*) FROM work_items w WHERE w.activity_id = a.id) AS activity_action_count,
        (SELECT group_concat(w.public_id, ', ') FROM work_items w WHERE w.activity_id = a.id) AS related_actions,
        s.department_id, d.name AS department
      FROM activities a
      JOIN sub_goals sg ON sg.id = a.sub_goal_id
      LEFT JOIN people p ON p.id = a.owner_person_id
      LEFT JOIN seats s ON s.id = p.seat_id
      LEFT JOIN departments d ON d.id = s.department_id
      ${extra}
    `;
  }

  list(user?: SessionUser) {
    const scope = user?.scope === "DEPARTMENT"
      ? "AND s.department_id = @scopeDepartment"
      : user?.scope === "OWN" ? "AND a.owner_person_id = @scopePerson" : "";
    return getDatabase().prepare(`${this.query(`WHERE 1 = 1 ${scope}`)} ORDER BY sg.goal_id, a.sub_goal_id, a.title`)
      .all({ scopeDepartment: user?.department_id, scopePerson: user?.person_id });
  }

  get(id: string, user?: SessionUser) {
    const scope = user?.scope === "DEPARTMENT"
      ? "AND s.department_id = @scopeDepartment"
      : user?.scope === "OWN" ? "AND a.owner_person_id = @scopePerson" : "";
    return getDatabase().prepare(this.query(`WHERE a.id = @id ${scope}`))
      .get({ id, scopeDepartment: user?.department_id, scopePerson: user?.person_id });
  }

  getUnscoped(id: string) {
    return getDatabase().prepare(this.query("WHERE a.id = @id")).get({ id });
  }

  scopeForInput(input: Pick<ActivityRecord, "ownerPersonId">) {
    if (!input.ownerPersonId) return { ownerPersonId: null, departmentId: null };
    const row = getDatabase().prepare(`
      SELECT p.id AS ownerPersonId, s.department_id AS departmentId
      FROM people p LEFT JOIN seats s ON s.id = p.seat_id WHERE p.id = ?
    `).get(input.ownerPersonId) as { ownerPersonId: string; departmentId?: string } | undefined;
    if (!row) throw new RepositoryError("VALIDATION", "The activity owner does not exist.");
    return row;
  }

  create(input: ActivityRecord) {
    const id = input.id?.trim() || randomUUID();
    if (!input.subGoalId?.trim() || !input.title?.trim()) {
      throw new RepositoryError("VALIDATION", "Sub-goal and activity title are required.");
    }
    if (input.title.trim().length > 200) throw new RepositoryError("VALIDATION", "The activity title is too long.");
    if (!getDatabase().prepare("SELECT id FROM sub_goals WHERE id = ?").get(input.subGoalId)) {
      throw new RepositoryError("VALIDATION", "The related sub-goal does not exist.");
    }
    this.scopeForInput(input);
    try {
      getDatabase().prepare(`
        INSERT INTO activities (id, sub_goal_id, title, description, owner_person_id)
        VALUES (@id, @subGoalId, @title, @description, @ownerPersonId)
      `).run({
        id,
        subGoalId: input.subGoalId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        ownerPersonId: input.ownerPersonId?.trim() || null
      });
      return this.getUnscoped(id);
    } catch (error) { return mapDatabaseError(error); }
  }

  update(id: string, input: Partial<Omit<ActivityRecord, "id">>) {
    const current = this.getUnscoped(id) as Record<string, unknown> | undefined;
    if (!current) throw new RepositoryError("NOT_FOUND", "The activity was not found.");
    const merged = {
      subGoalId: input.subGoalId ?? String(current.sub_goal_id),
      title: input.title ?? String(current.title),
      description: input.description ?? (current.description == null ? undefined : String(current.description)),
      ownerPersonId: input.ownerPersonId ?? (current.owner_person_id == null ? undefined : String(current.owner_person_id))
    };
    if (!merged.subGoalId.trim() || !merged.title.trim()) throw new RepositoryError("VALIDATION", "Sub-goal and activity title are required.");
    if (merged.title.trim().length > 200) throw new RepositoryError("VALIDATION", "The activity title is too long.");
    if (!getDatabase().prepare("SELECT id FROM sub_goals WHERE id = ?").get(merged.subGoalId)) {
      throw new RepositoryError("VALIDATION", "The related sub-goal does not exist.");
    }
    this.scopeForInput(merged);
    try {
      getDatabase().prepare(`
        UPDATE activities SET sub_goal_id=@subGoalId, title=@title, description=@description,
          owner_person_id=@ownerPersonId, updated_at=CURRENT_TIMESTAMP WHERE id=@id
      `).run({
        id,
        subGoalId: merged.subGoalId,
        title: merged.title.trim(),
        description: merged.description?.trim() || null,
        ownerPersonId: merged.ownerPersonId?.trim() || null
      });
      return this.getUnscoped(id);
    } catch (error) { return mapDatabaseError(error); }
  }
}

/**
 * LEGACY/AMBIGUOUS compatibility repository.
 * Despite its historical name, this repository reads and writes seats
 * (Position data). It is not a BusinessRole or authorization-role repository.
 */
export class RoleRepository {
  list() { return getDatabase().prepare("SELECT * FROM seats ORDER BY title").all(); }
  get(id: string) { return getDatabase().prepare("SELECT * FROM seats WHERE id = ?").get(id); }
  create(input: { id: string; title: string; departmentId: string }) {
    if (!input.id.trim() || !input.title.trim() || !input.departmentId.trim()) throw new RepositoryError("VALIDATION", "Role ID, title, and department are required.");
    try { getDatabase().prepare("INSERT INTO seats (id, title, department_id) VALUES (@id,@title,@departmentId)").run(input); return this.get(input.id); } catch (error) { return mapDatabaseError(error); }
  }
  update(id: string, input: { title?: string; departmentId?: string }) {
    if (!this.get(id)) throw new RepositoryError("NOT_FOUND", "The role was not found.");
    try {
      getDatabase().prepare("UPDATE seats SET title=COALESCE(@title,title), department_id=COALESCE(@departmentId,department_id) WHERE id=@id").run({
        id,
        title: input.title ?? null,
        departmentId: input.departmentId ?? null
      });
      return this.get(id);
    } catch (error) { return mapDatabaseError(error); }
  }
}

export class PersonRepository {
  list() { return getDatabase().prepare("SELECT * FROM people WHERE active = 1 ORDER BY full_name").all(); }
  get(id: string) { return getDatabase().prepare("SELECT * FROM people WHERE id = ?").get(id); }
  create(input: { id: string; fullName: string; seatId?: string }) {
    if (!input.id.trim() || !input.fullName.trim()) throw new RepositoryError("VALIDATION", "Person ID and name are required.");
    try { getDatabase().prepare("INSERT INTO people (id, full_name, seat_id) VALUES (@id,@fullName,@seatId)").run(input); return this.get(input.id); } catch (error) { return mapDatabaseError(error); }
  }
  update(id: string, input: { fullName?: string; seatId?: string; active?: boolean }) {
    if (!this.get(id)) throw new RepositoryError("NOT_FOUND", "The person was not found.");
    try {
      getDatabase().prepare("UPDATE people SET full_name=COALESCE(@fullName,full_name), seat_id=COALESCE(@seatId,seat_id), active=COALESCE(@active,active) WHERE id=@id").run({
        id,
        fullName: input.fullName ?? null,
        seatId: input.seatId ?? null,
        active: input.active === undefined ? null : input.active ? 1 : 0
      });
      return this.get(id);
    } catch (error) { return mapDatabaseError(error); }
  }
}

export class UserRepository {
  list() {
    return getDatabase().prepare(`
      SELECT u.id, u.username, u.person_id, u.department_id, u.active, r.code AS role, r.title AS role_title
      FROM users u JOIN app_roles r ON r.id = u.role_id ORDER BY u.username
    `).all();
  }
  get(id: string) { return getDatabase().prepare("SELECT id, username, person_id, department_id, role_id, active FROM users WHERE id = ?").get(id); }
  create(input: { id: string; username: string; password: string; personId?: string; departmentId?: string; roleId: string }) {
    if (!input.id.trim() || !input.username.trim() || !input.password || !input.roleId) throw new RepositoryError("VALIDATION", "User identity, password, and role are required.");
    try {
      getDatabase().prepare(`
        INSERT INTO users (id, username, password_hash, person_id, department_id, role_id)
        VALUES (@id, @username, @passwordHash, @personId, @departmentId, @roleId)
      `).run({ ...input, passwordHash: hashPasswordForStorage(input.password) });
      return this.get(input.id);
    } catch (error) { return mapDatabaseError(error); }
  }
  update(id: string, input: { username?: string; password?: string; personId?: string; departmentId?: string; roleId?: string; active?: boolean }) {
    const current = this.get(id);
    if (!current) throw new RepositoryError("NOT_FOUND", "The user was not found.");
    try {
      getDatabase().prepare(`
        UPDATE users SET username=COALESCE(@username,username),
          password_hash=COALESCE(@passwordHash,password_hash),
          person_id=COALESCE(@personId,person_id),
          department_id=COALESCE(@departmentId,department_id),
          role_id=COALESCE(@roleId,role_id),
          active=COALESCE(@active,active), updated_at=CURRENT_TIMESTAMP
        WHERE id=@id
      `).run({
        id,
        username: input.username ?? null,
        passwordHash: input.password ? hashPasswordForStorage(input.password) : null,
        personId: input.personId ?? null,
        departmentId: input.departmentId ?? null,
        roleId: input.roleId ?? null,
        active: input.active === undefined ? null : input.active ? 1 : 0
      });
      return this.get(id);
    } catch (error) { return mapDatabaseError(error); }
  }
}

export class ActionRepository {
  list(user?: SessionUser) {
    const scopeClause = user?.scope === "DEPARTMENT" ? "AND w.department_id = @scopeDepartment" : user?.scope === "OWN" ? "AND w.owner_person_id = @scopePerson" : "";
    return getDatabase().prepare(`
      SELECT w.*, p.full_name AS owner, d.name AS department, a.title AS activity_title
      FROM work_items w
      JOIN people p ON p.id = w.owner_person_id
      JOIN departments d ON d.id = w.department_id
      LEFT JOIN activities a ON a.id = w.activity_id
      WHERE w.plan_year = 1405 ${scopeClause} ORDER BY w.planned_end, w.public_id
    `).all({ scopeDepartment: user?.department_id, scopePerson: user?.person_id });
  }
  get(publicId: string, user?: SessionUser) {
    const scopeClause = user?.scope === "DEPARTMENT" ? "AND w.department_id = @scopeDepartment" : user?.scope === "OWN" ? "AND w.owner_person_id = @scopePerson" : "";
    return getDatabase().prepare(`
      SELECT w.*, p.full_name AS owner, d.name AS department, a.title AS activity_title
      FROM work_items w JOIN people p ON p.id = w.owner_person_id JOIN departments d ON d.id = w.department_id
      LEFT JOIN activities a ON a.id = w.activity_id
      WHERE w.public_id = @publicId ${scopeClause}
    `).get({ publicId, scopeDepartment: user?.department_id, scopePerson: user?.person_id });
  }
  create(input: WorkItem & { departmentId: string; publicId?: string; activityId?: string; description?: string; roleId?: string; externalSourceId?: string }): unknown {
    const publicId = input.publicId ?? nextPublicId(input.goalId ?? "G01");
    const normalized = { ...input, publicId };
    const errors = validateWorkItem(normalized, new Set((new GoalRepository()).list().map((goal) => (goal as { id: string }).id)));
    if (errors.length) throw new RepositoryError("VALIDATION", errors.join(" "));
    if (input.activityId) resolveActivityId(input.activityId, input.goalId);
    const db = getDatabase();
    try {
      db.prepare(`
        INSERT INTO work_items
        (id, public_id, goal_id, department_id, owner_person_id, title, work_type, deliverable, status, progress, planned_start, planned_end, activity_id, description, role_id, external_source_id, plan_year)
        VALUES (@id, @publicId, @goalId, @departmentId, @ownerPersonId, @title, @workType, @deliverable, @status, @progress, @plannedStart, @deadline, @activityId, @description, @roleId, @externalSourceId, 1405)
      `).run({ ...normalized, id: randomUUID(), publicId, plannedStart: input.plannedStart ?? "۱۴۰۵/۰۱/۰۱", activityId: input.activityId ?? null, description: input.description ?? null, roleId: input.roleId ?? null, externalSourceId: input.externalSourceId ?? null });
      return this.get(publicId);
    } catch (error) { return mapDatabaseError(error); }
  }
  update(publicId: string, input: Partial<WorkItem> & { departmentId?: string; activityId?: string }): unknown {
    const current = this.get(publicId) as Record<string, unknown> | undefined;
    if (!current) throw new RepositoryError("NOT_FOUND", "The action was not found.");
    const merged = {
      publicId,
      goalId: input.goalId ?? String(current.goal_id),
      title: input.title ?? String(current.title),
      workType: input.workType ?? current.work_type as WorkItem["workType"],
      ownerPersonId: input.ownerPersonId ?? String(current.owner_person_id),
      deliverable: input.deliverable ?? String(current.deliverable),
      deadline: input.deadline ?? String(current.planned_end),
      plannedStart: input.plannedStart ?? String(current.planned_start),
      status: input.status ?? current.status as WorkItem["status"],
      progress: input.progress ?? Number(current.progress)
    } as WorkItem;
    const errors = validateWorkItem(merged, new Set((new GoalRepository()).list().map((goal) => (goal as { id: string }).id)));
    if (errors.length) throw new RepositoryError("VALIDATION", errors.join(" "));
    if (input.activityId) resolveActivityId(input.activityId, merged.goalId);
    try {
      getDatabase().prepare(`
        UPDATE work_items SET goal_id=@goalId, department_id=COALESCE(@departmentId, department_id),
        owner_person_id=@ownerPersonId, title=@title, work_type=@workType, deliverable=@deliverable,
        status=@status, progress=@progress, planned_start=@plannedStart, planned_end=@deadline,
        activity_id=COALESCE(@activityId, activity_id)
        WHERE public_id=@publicId
      `).run({ ...merged, departmentId: input.departmentId ?? String(current.department_id), ownerPersonId: merged.ownerPersonId, activityId: input.activityId ?? null });
      return this.get(publicId);
    } catch (error) { return mapDatabaseError(error); }
  }
}

function nextPublicId(goalId: string): string {
  const db = getDatabase();
  const prefix = `${goalId}-O01-A01-T`;
  const rows = db.prepare("SELECT public_id FROM work_items WHERE public_id LIKE ?").all(`${prefix}%`) as Array<{ public_id: string }>;
  const max = rows.reduce((largest, row) => Math.max(largest, Number(row.public_id.split("-T").pop() ?? 0)), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export class KPIRepository {
  list() { return getDatabase().prepare("SELECT * FROM kpis ORDER BY name").all(); }
  get(id: string) { return getDatabase().prepare("SELECT * FROM kpis WHERE id = ?").get(id); }
  create(input: KpiRecord & { ownerPersonId: string; workItemId?: string; kind?: string }) {
    try {
      getDatabase().prepare(`
        INSERT INTO kpis (id, work_item_id, name, kind, target, actual, direction, owner_person_id)
        VALUES (@id, @workItemId, @name, @kind, @target, @actual, @direction, @ownerPersonId)
      `).run({ ...input, workItemId: resolveWorkItemId(input.workItemId), kind: input.kind ?? "شاخص نتیجه" });
      return this.get(input.id);
    } catch (error) { return mapDatabaseError(error); }
  }
  update(id: string, input: Partial<KpiRecord>) {
    if (!this.get(id)) throw new RepositoryError("NOT_FOUND", "The KPI was not found.");
    try {
      getDatabase().prepare("UPDATE kpis SET actual=COALESCE(@actual, actual), target=COALESCE(@target, target), name=COALESCE(@name, name) WHERE id=@id").run({ ...input, id });
      return this.get(id);
    } catch (error) { return mapDatabaseError(error); }
  }
}

export class RiskRepository {
  list() { return getDatabase().prepare("SELECT *, probability * impact AS severity FROM risks ORDER BY severity DESC").all(); }
  get(id: string) { return getDatabase().prepare("SELECT *, probability * impact AS severity FROM risks WHERE id = ?").get(id); }
  create(input: RiskRecord & { goalId: string; ownerPersonId: string; workItemId?: string }) {
    try {
      getDatabase().prepare("INSERT INTO risks (id, goal_id, work_item_id, title, probability, impact, owner_person_id, response_action, status) VALUES (@id,@goalId,@workItemId,@title,@probability,@impact,@ownerPersonId,@responseAction,@status)").run({ ...input, workItemId: resolveWorkItemId(input.workItemId) });
      return this.get(input.id);
    } catch (error) { return mapDatabaseError(error); }
  }
  update(id: string, input: Partial<RiskRecord>) {
    if (!this.get(id)) throw new RepositoryError("NOT_FOUND", "The risk was not found.");
    try {
      getDatabase().prepare("UPDATE risks SET title=COALESCE(@title,title), probability=COALESCE(@probability,probability), impact=COALESCE(@impact,impact), status=COALESCE(@status,status), response_action=COALESCE(@responseAction,response_action) WHERE id=@id").run({ ...input, id, responseAction: input.responseAction });
      return this.get(id);
    } catch (error) { return mapDatabaseError(error); }
  }
}

export class DependencyRepository {
  list() { return getDatabase().prepare("SELECT * FROM dependencies ORDER BY delay_days DESC").all(); }
  get(id: string) { return getDatabase().prepare("SELECT * FROM dependencies WHERE id = ?").get(id); }
  create(input: Dependency & { id?: string }) {
    try {
      const id = input.id ?? randomUUID();
      getDatabase().prepare("INSERT INTO dependencies (id, source_work_item_id, target_work_item_id, status, delay_days, notes) VALUES (@id,@sourceWorkItemId,@targetWorkItemId,@status,@delayDays,@notes)").run({ ...input, id, sourceWorkItemId: resolveWorkItemId(input.sourceWorkItemId), targetWorkItemId: resolveWorkItemId(input.targetWorkItemId) });
      return this.get(id);
    } catch (error) { return mapDatabaseError(error); }
  }
  update(id: string, input: Partial<Dependency>) {
    if (!this.get(id)) throw new RepositoryError("NOT_FOUND", "The dependency was not found.");
    try {
      getDatabase().prepare("UPDATE dependencies SET status=COALESCE(@status,status), delay_days=COALESCE(@delayDays,delay_days), notes=COALESCE(@notes,notes) WHERE id=@id").run({ ...input, id });
      return this.get(id);
    } catch (error) { return mapDatabaseError(error); }
  }
}

function resolveWorkItemId(identifier?: string): string | null {
  if (!identifier) return null;
  if (identifier.startsWith("wi-")) return identifier;
  const row = getDatabase().prepare("SELECT id FROM work_items WHERE public_id = ?").get(identifier) as { id: string } | undefined;
  if (!row) throw new RepositoryError("VALIDATION", "The related action does not exist.");
  return row.id;
}

function resolveActivityId(identifier: string, goalId?: string): string {
  const row = getDatabase().prepare(`
    SELECT a.id, sg.goal_id
    FROM activities a JOIN sub_goals sg ON sg.id = a.sub_goal_id
    WHERE a.id = ?
  `).get(identifier) as { id: string; goal_id: string } | undefined;
  if (!row) throw new RepositoryError("VALIDATION", "The related activity does not exist.");
  if (goalId && row.goal_id !== goalId) throw new RepositoryError("VALIDATION", "The activity does not belong to the selected goal.");
  return row.id;
}

export class MonthlyReviewRepository {
  list() { return getDatabase().prepare("SELECT * FROM monthly_reviews ORDER BY month_key DESC").all(); }
  get(id: string) { return getDatabase().prepare("SELECT * FROM monthly_reviews WHERE id = ?").get(id); }
  create(input: Record<string, unknown>) {
    try {
      const id = String(input.id ?? randomUUID());
      getDatabase().prepare("INSERT INTO monthly_reviews (id, month_key, department_id, plan_summary, actual_summary, deviation, root_cause, corrective_action, management_decision, next_month_commitment) VALUES (@id,@monthKey,@departmentId,@planSummary,@actualSummary,@deviation,@rootCause,@correctiveAction,@managementDecision,@nextMonthCommitment)").run({ ...input, id });
      return this.get(id);
    } catch (error) { return mapDatabaseError(error); }
  }
  update(id: string, input: Record<string, unknown>) {
    if (!this.get(id)) throw new RepositoryError("NOT_FOUND", "The monthly review was not found.");
    try {
      getDatabase().prepare("UPDATE monthly_reviews SET plan_summary=COALESCE(@planSummary,plan_summary), actual_summary=COALESCE(@actualSummary,actual_summary), deviation=COALESCE(@deviation,deviation), root_cause=COALESCE(@rootCause,root_cause), corrective_action=COALESCE(@correctiveAction,corrective_action), management_decision=COALESCE(@managementDecision,management_decision), next_month_commitment=COALESCE(@nextMonthCommitment,next_month_commitment) WHERE id=@id").run({ ...input, id });
      return this.get(id);
    } catch (error) { return mapDatabaseError(error); }
  }
}

export function getProgramQuality() {
  const actions = new ActionRepository().list() as Array<Record<string, unknown>>;
  const goals = new GoalRepository().list() as Array<{ id: string }>;
  const kpis = new KPIRepository().list() as Array<{ work_item_id?: string; id: string }>;
  const dependencies = new DependencyRepository().list() as Array<Record<string, unknown>>;
  return inspectProgramQuality(actions.map((action) => ({ publicId: String(action.public_id), goalId: String(action.goal_id), ownerPersonId: String(action.owner_person_id), deliverable: String(action.deliverable), deadline: String(action.planned_end), status: action.status as WorkItem["status"], progress: Number(action.progress), title: String(action.title), workType: action.work_type as WorkItem["workType"] })), new Set(goals.map((goal) => goal.id)), new Set(kpis.map((kpi) => String(kpi.work_item_id ?? kpi.id))), dependencies.map((dependency) => ({ sourceWorkItemId: String(dependency.source_work_item_id), targetWorkItemId: String(dependency.target_work_item_id), status: dependency.status as "باز" | "حل‌شده", delayDays: Number(dependency.delay_days) })));
}
