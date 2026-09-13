import type Database from "better-sqlite3";

export type PulseIdentifierType = "goal" | "action";

export type ActionIdentifierScope = {
  planYear: number;
  goalId: string;
  objectiveId?: string;
  activityId?: string;
  /** Existing format may be used as a shape hint, never as the allocated value. */
  shapeHint?: string;
};

type GoalIdentifierScope = { planYear?: number; preferredId?: string };

function nextValue(database: Database.Database, key: string, initialValue: number): number {
  database.prepare(
    `INSERT INTO pulse_identifier_allocations (allocation_key, entity_type, last_value)
     VALUES (?, ?, ?)
     ON CONFLICT(allocation_key) DO NOTHING`
  ).run(key, key.startsWith("goal:") ? "goal" : "action", initialValue);
  database.prepare("UPDATE pulse_identifier_allocations SET last_value = MAX(last_value, ?) WHERE allocation_key = ?")
    .run(initialValue, key);
  const row = database.prepare(
    "UPDATE pulse_identifier_allocations SET last_value = last_value + 1 WHERE allocation_key = ? RETURNING last_value"
  ).get(key) as { last_value: number } | undefined;
  if (!row) throw new Error(`Unable to allocate PULSE identifier for ${key}.`);
  return row.last_value;
}

function maxGoalNumber(database: Database.Database): number {
  const rows = database.prepare("SELECT id FROM strategic_goals WHERE id GLOB 'G[0-9]*'").all() as Array<{ id: string }>;
  return rows.reduce((max, row) => Math.max(max, Number(/^G(\d+)$/.exec(row.id)?.[1] ?? 0)), 0);
}

function actionShape(scope: ActionIdentifierScope): string {
  const hinted = scope.shapeHint?.match(/^(G\d{2}-O\d{2}-A\d{2})-T\d{3}$/)?.[1];
  if (hinted) return hinted;
  const goal = /^G\d{2}$/.test(scope.goalId) ? scope.goalId : "G01";
  const objective = scope.objectiveId?.match(/(?:^|-)O(\d{2})(?:-|$)/)?.[1] ?? "01";
  const activity = scope.activityId?.match(/(?:^|-)A(\d{2})(?:-|$)/)?.[1] ?? "01";
  return `${goal}-O${objective}-A${activity}`;
}

function maxActionNumber(database: Database.Database, shape: string, planYear: number): number {
  const rows = database.prepare("SELECT public_id FROM work_items WHERE plan_year = ? AND public_id LIKE ?")
    .all(planYear, `${shape}-T%`) as Array<{ public_id: string }>;
  return rows.reduce((max, row) => Math.max(max, Number(/-T(\d+)$/.exec(row.public_id)?.[1] ?? 0)), 0);
}

export class IdentifierService {
  constructor(private readonly database: Database.Database) {}

  generate(type: "goal", scope?: GoalIdentifierScope): string;
  generate(type: "action", scope: ActionIdentifierScope): string;
  generate(type: PulseIdentifierType, scope: { planYear?: number } | ActionIdentifierScope = {}): string {
    if (type === "goal") {
      const preferred = (scope as GoalIdentifierScope).preferredId;
      if (preferred && /^G\d+$/.test(preferred)
        && !this.database.prepare("SELECT 1 FROM strategic_goals WHERE id=?").get(preferred)) {
        const reserved = this.database.prepare(
          `INSERT OR IGNORE INTO pulse_identifier_allocations (allocation_key, entity_type, last_value)
           VALUES (?, 'goal', 1)`
        ).run(`goal:value:${preferred}`);
        if (reserved.changes === 1) return preferred;
      }
      const initial = maxGoalNumber(this.database);
      const number = nextValue(this.database, "goal:global", initial);
      return `G${String(number).padStart(2, "0")}`;
    }
    const actionScope = scope as ActionIdentifierScope;
    const shape = actionShape(actionScope);
    const key = `action:${actionScope.planYear}:${shape}`;
    const initial = maxActionNumber(this.database, shape, actionScope.planYear);
    const number = nextValue(this.database, key, initial);
    return `${shape}-T${String(number).padStart(3, "0")}`;
  }

  generateInTransaction<T>(callback: () => T): T {
    return this.database.transaction(callback)();
  }
}

export function createIdentifierService(database: Database.Database): IdentifierService {
  return new IdentifierService(database);
}
