import type Database from "better-sqlite3";

export type PulseIdentifierType =
  | "department" | "position" | "person"
  | "program" | "goal" | "departmental_goal" | "objective" | "activity" | "action"
  | "kpi" | "risk" | "dependency" | "monthly_review";

export type ActionIdentifierScope = {
  planYear: number;
  goalId: string;
  objectiveId?: string;
  activityId?: string;
  shapeHint?: string;
};

export type IdentifierScope = {
  planYear?: number;
  parentId?: string;
  goalId?: string;
  objectiveId?: string;
  activityId?: string;
  shapeHint?: string;
};

type GoalIdentifierScope = { planYear?: number };

const policies: Record<Exclude<PulseIdentifierType, "goal" | "action">, { prefix: string; scope: (scope: IdentifierScope) => string }> = {
  department: { prefix: "UNIT", scope: () => "global" },
  position: { prefix: "POS", scope: () => "global" },
  person: { prefix: "PER", scope: () => "global" },
  program: { prefix: "PROG", scope: (scope) => `cycle:${scope.planYear ?? "global"}` },
  departmental_goal: { prefix: "DG", scope: (scope) => `cycle:${scope.planYear ?? "global"}` },
  objective: { prefix: "OBJ", scope: (scope) => `parent:${scope.parentId ?? "global"}` },
  activity: { prefix: "ACT", scope: (scope) => `parent:${scope.parentId ?? "global"}` },
  kpi: { prefix: "KPI", scope: (scope) => `cycle:${scope.planYear ?? "global"}` },
  risk: { prefix: "RISK", scope: (scope) => `cycle:${scope.planYear ?? "global"}` },
  dependency: { prefix: "DEP", scope: () => "global" },
  monthly_review: { prefix: "REV", scope: (scope) => `cycle:${scope.planYear ?? "global"}` }
};

function nextValue(database: Database.Database, key: string, entityType: string, initialValue: number): number {
  database.prepare(`
    INSERT INTO pulse_identifier_allocations (allocation_key, entity_type, last_value)
    VALUES (?, ?, ?)
    ON CONFLICT(allocation_key) DO NOTHING
  `).run(key, entityType, initialValue);
  database.prepare("UPDATE pulse_identifier_allocations SET last_value = MAX(last_value, ?) WHERE allocation_key = ?")
    .run(initialValue, key);
  const row = database.prepare(
    "UPDATE pulse_identifier_allocations SET last_value = last_value + 1 WHERE allocation_key = ? RETURNING last_value"
  ).get(key) as { last_value: number } | undefined;
  if (!row) throw new Error(`Unable to allocate PULSE identifier for ${key}.`);
  return row.last_value;
}

function maxGoalNumber(database: Database.Database): number {
  const rows = database.prepare("SELECT pulse_identifier FROM pulse_entity_identities WHERE entity_type = 'goal'").all() as Array<{ pulse_identifier: string }>;
  return rows.reduce((max, row) => Math.max(max, Number(/^G(\d+)$/.exec(row.pulse_identifier)?.[1] ?? 0)), 0);
}

function actionShape(scope: ActionIdentifierScope): string {
  const hinted = scope.shapeHint?.match(/^(G\d{2}-O\d{2}-A\d{2})-T\d{3}$/)?.[1];
  if (hinted) return hinted;
  const goal = /^G\d{2}$/.test(scope.goalId) ? scope.goalId : "G01";
  const objective = scope.objectiveId?.match(/(?:^|-)O(\d{2})(?:-|$)/)?.[1] ?? "01";
  const activity = scope.activityId?.match(/(?:^|-)A(\d{2})(?:-|$)/)?.[1] ?? "01";
  return `${goal}-O${objective}-A${activity}`;
}

export class IdentifierService {
  private readonly database: Database.Database;

  constructor(database: Database.Database) { this.database = database; }

  generate(type: "goal", scope?: GoalIdentifierScope): string;
  generate(type: "action", scope: ActionIdentifierScope): string;
  generate(type: Exclude<PulseIdentifierType, "goal" | "action">, scope?: IdentifierScope): string;
  generate(type: PulseIdentifierType, scope: { planYear?: number } | ActionIdentifierScope | IdentifierScope = {}): string {
    if (type === "goal") {
      const number = nextValue(this.database, "goal:global", "goal", maxGoalNumber(this.database));
      return `G${String(number).padStart(2, "0")}`;
    }
    if (type === "action") {
      const actionScope = scope as ActionIdentifierScope;
      const shape = actionShape(actionScope);
      const key = `action:${actionScope.planYear}:${shape}`;
      const rows = this.database.prepare("SELECT pulse_identifier FROM pulse_entity_identities WHERE entity_type = 'action' AND pulse_identifier LIKE ?")
        .all(`${shape}-T%`) as Array<{ pulse_identifier: string }>;
      const initial = rows.reduce((max, row) => Math.max(max, Number(/-T(\d+)$/.exec(row.pulse_identifier)?.[1] ?? 0)), 0);
      const number = nextValue(this.database, key, "action", initial);
      return `${shape}-T${String(number).padStart(3, "0")}`;
    }
    const policy = policies[type as Exclude<PulseIdentifierType, "goal" | "action">];
    if (!policy) throw new Error(`Unsupported PULSE identifier type: ${type}`);
    const identifierScope = scope as IdentifierScope;
    const key = `${type}:${policy.scope(identifierScope)}`;
    const rows = this.database.prepare("SELECT pulse_identifier FROM pulse_entity_identities WHERE pulse_identifier LIKE ?")
      .all(`${policy.prefix}-%`) as Array<{ pulse_identifier: string }>;
    const initial = rows.reduce((max, row) => Math.max(max, Number(new RegExp(`^${policy.prefix}-(\\d+)$`).exec(row.pulse_identifier)?.[1] ?? 0)), 0);
    const number = nextValue(this.database, key, type, initial);
    return `${policy.prefix}-${String(number).padStart(3, "0")}`;
  }

  generateInTransaction<T>(callback: () => T): T { return this.database.transaction(callback)(); }

  register(technicalId: string, entityType: PulseIdentifierType, pulseIdentifier: string, externalSourceId?: string | null): void {
    this.database.prepare("INSERT OR IGNORE INTO pulse_entity_identities (technical_id, entity_type, pulse_identifier, external_source_id) VALUES (?, ?, ?, ?)")
      .run(technicalId, entityType, pulseIdentifier, externalSourceId ?? null);
  }
}

export function createIdentifierService(database: Database.Database): IdentifierService {
  return new IdentifierService(database);
}
