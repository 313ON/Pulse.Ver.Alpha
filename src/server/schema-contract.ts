import type Database from "better-sqlite3";

type ColumnContract = {
  type: string;
  notNull?: boolean;
  defaultValue?: string;
};

type ForeignKeyContract = {
  table: string;
  from: string;
  to: string;
  onDelete: string;
};

const column = (type: string, options: Omit<ColumnContract, "type"> = {}): ColumnContract => ({ type, ...options });

export const requiredTables = [
  "strategic_goals",
  "departments",
  "seats",
  "people",
  "sub_goals",
  "work_items",
  "work_item_collaborators",
  "work_item_assignments",
  "kpis",
  "risks",
  "dependencies",
  "monthly_reviews",
  "activities",
  "app_roles",
  "permissions",
  "role_permissions",
  "users",
  "sessions",
  "audit_log",
  "import_jobs",
  "import_records",
  "departmental_materialization_operations",
  "departmental_planning_records",
  "import_analysis_revisions",
  "import_remediations",
  "pulse_release_metadata"
] as const;

export const requiredIndexes = [
  "work_items_goal_idx",
  "work_items_owner_idx",
  "work_items_due_idx",
  "risks_severity_idx",
  "audit_log_entity_idx",
  "import_analysis_revisions_job_idx",
  "import_remediations_job_idx",
  "sessions_expiry_idx",
  "departmental_materialization_source_fingerprint_idx"
] as const;

export const requiredTriggers = [
  "audit_log_immutable_update",
  "audit_log_immutable_delete"
] as const;

export const requiredColumns: Record<string, Record<string, ColumnContract>> = {
  strategic_goals: {
    id: column("TEXT"),
    title: column("TEXT", { notNull: true }),
    owner_person_id: column("TEXT"),
    plan_year: column("INTEGER", { notNull: true })
  },
  departments: {
    id: column("TEXT"),
    name: column("TEXT", { notNull: true }),
    active: column("INTEGER", { notNull: true, defaultValue: "1" })
  },
  seats: {
    id: column("TEXT"),
    title: column("TEXT", { notNull: true }),
    department_id: column("TEXT", { notNull: true })
  },
  people: {
    id: column("TEXT"),
    full_name: column("TEXT", { notNull: true }),
    seat_id: column("TEXT"),
    active: column("INTEGER", { notNull: true, defaultValue: "1" })
  },
  sub_goals: {
    id: column("TEXT"),
    goal_id: column("TEXT", { notNull: true }),
    title: column("TEXT", { notNull: true }),
    owner_person_id: column("TEXT")
  },
  work_items: {
    id: column("TEXT"),
    public_id: column("TEXT", { notNull: true }),
    goal_id: column("TEXT", { notNull: true }),
    sub_goal_id: column("TEXT"),
    department_id: column("TEXT"),
    owner_person_id: column("TEXT"),
    title: column("TEXT", { notNull: true }),
    work_type: column("TEXT"),
    deliverable: column("TEXT"),
    status: column("TEXT", { notNull: true, defaultValue: "'پیش‌نویس'" }),
    progress: column("INTEGER", { notNull: true, defaultValue: "0" }),
    planned_start: column("TEXT"),
    planned_end: column("TEXT"),
    actual_completion: column("TEXT"),
    priority: column("TEXT"),
    blocker: column("TEXT"),
    notes: column("TEXT"),
    activity_id: column("TEXT"),
    description: column("TEXT"),
    role_id: column("TEXT"),
    target: column("TEXT"),
    risk_id: column("TEXT"),
    attachments_json: column("TEXT"),
    external_source_id: column("TEXT"),
    created_at: column("TEXT", { notNull: true, defaultValue: "CURRENT_TIMESTAMP" }),
    updated_at: column("TEXT", { notNull: true, defaultValue: "CURRENT_TIMESTAMP" }),
    plan_year: column("INTEGER", { notNull: true })
  },
  work_item_collaborators: {
    work_item_id: column("TEXT", { notNull: true }),
    person_id: column("TEXT", { notNull: true })
  },
  work_item_assignments: {
    id: column("TEXT"),
    work_item_id: column("TEXT", { notNull: true }),
    raci_type: column("TEXT", { notNull: true }),
    target_type: column("TEXT", { notNull: true }),
    target_id: column("TEXT"),
    display_name: column("TEXT", { notNull: true }),
    normalized_name: column("TEXT", { notNull: true }),
    resolved: column("INTEGER", { notNull: true, defaultValue: "0" }),
    source_json: column("TEXT")
  },
  kpis: {
    id: column("TEXT"),
    work_item_id: column("TEXT"),
    name: column("TEXT", { notNull: true }),
    definition: column("TEXT"),
    kind: column("TEXT", { notNull: true }),
    unit: column("TEXT"),
    baseline: column("REAL"),
    target: column("REAL", { notNull: true }),
    actual: column("REAL", { notNull: true }),
    direction: column("TEXT", { notNull: true, defaultValue: "'higher-is-better'" }),
    frequency: column("TEXT"),
    owner_person_id: column("TEXT", { notNull: true })
  },
  risks: {
    id: column("TEXT"),
    goal_id: column("TEXT", { notNull: true }),
    work_item_id: column("TEXT"),
    title: column("TEXT", { notNull: true }),
    probability: column("INTEGER", { notNull: true }),
    impact: column("INTEGER", { notNull: true }),
    owner_person_id: column("TEXT", { notNull: true }),
    response_action: column("TEXT"),
    due_date: column("TEXT"),
    status: column("TEXT", { notNull: true, defaultValue: "'باز'" })
  },
  dependencies: {
    id: column("TEXT"),
    source_work_item_id: column("TEXT", { notNull: true }),
    target_work_item_id: column("TEXT", { notNull: true }),
    status: column("TEXT", { notNull: true, defaultValue: "'باز'" }),
    delay_days: column("INTEGER", { notNull: true, defaultValue: "0" }),
    notes: column("TEXT")
  },
  monthly_reviews: {
    id: column("TEXT"),
    month_key: column("TEXT", { notNull: true }),
    department_id: column("TEXT", { notNull: true }),
    plan_summary: column("TEXT"),
    actual_summary: column("TEXT"),
    deviation: column("TEXT"),
    root_cause: column("TEXT"),
    corrective_action: column("TEXT"),
    management_decision: column("TEXT"),
    next_month_commitment: column("TEXT")
  },
  activities: {
    id: column("TEXT"),
    sub_goal_id: column("TEXT", { notNull: true }),
    title: column("TEXT", { notNull: true }),
    description: column("TEXT"),
    owner_person_id: column("TEXT"),
    created_at: column("TEXT", { notNull: true, defaultValue: "CURRENT_TIMESTAMP" }),
    updated_at: column("TEXT", { notNull: true, defaultValue: "CURRENT_TIMESTAMP" })
  },
  app_roles: {
    id: column("TEXT"),
    code: column("TEXT", { notNull: true }),
    title: column("TEXT", { notNull: true }),
    scope: column("TEXT", { notNull: true, defaultValue: "'COMPANY'" }),
    active: column("INTEGER", { notNull: true, defaultValue: "1" })
  },
  permissions: {
    id: column("TEXT"),
    code: column("TEXT", { notNull: true }),
    title: column("TEXT", { notNull: true })
  },
  role_permissions: {
    role_id: column("TEXT", { notNull: true }),
    permission_id: column("TEXT", { notNull: true })
  },
  users: {
    id: column("TEXT"),
    username: column("TEXT", { notNull: true }),
    password_hash: column("TEXT", { notNull: true }),
    person_id: column("TEXT"),
    role_id: column("TEXT", { notNull: true }),
    department_id: column("TEXT"),
    active: column("INTEGER", { notNull: true, defaultValue: "1" }),
    created_at: column("TEXT", { notNull: true, defaultValue: "CURRENT_TIMESTAMP" }),
    updated_at: column("TEXT", { notNull: true, defaultValue: "CURRENT_TIMESTAMP" })
  },
  sessions: {
    id: column("TEXT"),
    user_id: column("TEXT", { notNull: true }),
    expires_at: column("TEXT", { notNull: true }),
    created_at: column("TEXT", { notNull: true, defaultValue: "CURRENT_TIMESTAMP" })
  },
  audit_log: {
    id: column("TEXT"),
    actor_user_id: column("TEXT"),
    entity_type: column("TEXT", { notNull: true }),
    entity_id: column("TEXT", { notNull: true }),
    event_type: column("TEXT", { notNull: true }),
    before_json: column("TEXT"),
    after_json: column("TEXT"),
    created_at: column("TEXT", { notNull: true, defaultValue: "CURRENT_TIMESTAMP" })
  },
  import_jobs: {
    id: column("TEXT"),
    source_json: column("TEXT", { notNull: true }),
    status: column("TEXT", { notNull: true }),
    validation_json: column("TEXT"),
    evaluation_json: column("TEXT"),
    assessment_json: column("TEXT"),
    quality_score_json: column("TEXT"),
    created_at: column("TEXT", { notNull: true }),
    approved_at: column("TEXT"),
    failure_reason: column("TEXT"),
    analysis_revision: column("INTEGER", { notNull: true, defaultValue: "0" }),
    baseline_program_json: column("TEXT")
  },
  departmental_materialization_operations: {
    operation_id: column("TEXT"),
    import_job_id: column("TEXT", { notNull: true }),
    approved_analysis_revision: column("INTEGER", { notNull: true }),
    source_snapshot_hash: column("TEXT", { notNull: true }),
    source_fingerprint: column("TEXT", { notNull: true }),
    actor_user_id: column("TEXT", { notNull: true }),
    target_plan_year: column("INTEGER", { notNull: true }),
    status: column("TEXT", { notNull: true }),
    record_count: column("INTEGER", { notNull: true }),
    provenance_count: column("INTEGER", { notNull: true }),
    created_at: column("TEXT", { notNull: true })
  },
  departmental_planning_records: {
    id: column("TEXT"),
    operation_id: column("TEXT", { notNull: true }),
    import_job_id: column("TEXT", { notNull: true }),
    source_record_id: column("TEXT", { notNull: true }),
    classification: column("TEXT", { notNull: true }),
    domain: column("TEXT"),
    entity_type: column("TEXT", { notNull: true }),
    normalized_data_json: column("TEXT", { notNull: true }),
    raw_record_json: column("TEXT", { notNull: true }),
    source_workbook: column("TEXT", { notNull: true }),
    source_sheet: column("TEXT"),
    source_row: column("INTEGER"),
    source_cell: column("TEXT"),
    provenance_json: column("TEXT", { notNull: true }),
    created_at: column("TEXT", { notNull: true })
  },
  import_records: {
    id: column("TEXT", { notNull: true }),
    job_id: column("TEXT", { notNull: true }),
    record_json: column("TEXT", { notNull: true })
  },
  import_analysis_revisions: {
    id: column("TEXT"),
    import_job_id: column("TEXT", { notNull: true }),
    revision: column("INTEGER", { notNull: true }),
    validation_json: column("TEXT", { notNull: true }),
    evaluation_json: column("TEXT"),
    assessment_json: column("TEXT", { notNull: true }),
    quality_score_json: column("TEXT", { notNull: true }),
    triggering_remediation_id: column("TEXT"),
    status: column("TEXT", { notNull: true }),
    created_at: column("TEXT", { notNull: true })
  },
  import_remediations: {
    id: column("TEXT"),
    import_job_id: column("TEXT", { notNull: true }),
    rule: column("TEXT", { notNull: true }),
    target_entity_type: column("TEXT", { notNull: true }),
    target_entity_id: column("TEXT", { notNull: true }),
    old_effective_owner: column("TEXT"),
    proposed_owner_id: column("TEXT", { notNull: true }),
    owner_display_name: column("TEXT", { notNull: true }),
    reason: column("TEXT", { notNull: true }),
    source_finding_json: column("TEXT", { notNull: true }),
    source_provenance_json: column("TEXT"),
    actor_user_id: column("TEXT", { notNull: true }),
    expected_analysis_revision: column("INTEGER", { notNull: true }),
    status: column("TEXT", { notNull: true }),
    resulting_analysis_revision: column("INTEGER"),
    supersedes_remediation_id: column("TEXT"),
    created_at: column("TEXT", { notNull: true })
  },
  pulse_release_metadata: {
    id: column("INTEGER", { notNull: true }),
    release_name: column("TEXT", { notNull: true }),
    application_version: column("TEXT", { notNull: true }),
    schema_version: column("TEXT", { notNull: true }),
    released_commit: column("TEXT", { notNull: true }),
    updated_at: column("TEXT", { notNull: true, defaultValue: "CURRENT_TIMESTAMP" })
  }
};

const requiredForeignKeys: ForeignKeyContract[] = [
  ["strategic_goals", "owner_person_id", "people", "id", "RESTRICT"],
  ["seats", "department_id", "departments", "id", "RESTRICT"],
  ["people", "seat_id", "seats", "id", "RESTRICT"],
  ["sub_goals", "goal_id", "strategic_goals", "id", "RESTRICT"],
  ["sub_goals", "owner_person_id", "people", "id", "RESTRICT"],
  ["work_items", "goal_id", "strategic_goals", "id", "RESTRICT"],
  ["work_items", "sub_goal_id", "sub_goals", "id", "RESTRICT"],
  ["work_items", "department_id", "departments", "id", "RESTRICT"],
  ["work_items", "owner_person_id", "people", "id", "RESTRICT"],
  ["work_item_collaborators", "work_item_id", "work_items", "id", "CASCADE"],
  ["work_item_collaborators", "person_id", "people", "id", "RESTRICT"],
  ["kpis", "work_item_id", "work_items", "id", "RESTRICT"],
  ["kpis", "owner_person_id", "people", "id", "RESTRICT"],
  ["risks", "goal_id", "strategic_goals", "id", "RESTRICT"],
  ["risks", "work_item_id", "work_items", "id", "RESTRICT"],
  ["risks", "owner_person_id", "people", "id", "RESTRICT"],
  ["dependencies", "source_work_item_id", "work_items", "id", "RESTRICT"],
  ["dependencies", "target_work_item_id", "work_items", "id", "RESTRICT"],
  ["monthly_reviews", "department_id", "departments", "id", "RESTRICT"],
  ["activities", "sub_goal_id", "sub_goals", "id", "RESTRICT"],
  ["activities", "owner_person_id", "people", "id", "RESTRICT"],
  ["role_permissions", "role_id", "app_roles", "id", "CASCADE"],
  ["role_permissions", "permission_id", "permissions", "id", "CASCADE"],
  ["users", "person_id", "people", "id", "RESTRICT"],
  ["users", "role_id", "app_roles", "id", "RESTRICT"],
  ["users", "department_id", "departments", "id", "RESTRICT"],
  ["sessions", "user_id", "users", "id", "CASCADE"],
  ["audit_log", "actor_user_id", "users", "id", "SET NULL"],
  ["import_records", "job_id", "import_jobs", "id", "CASCADE"],
  ["import_analysis_revisions", "import_job_id", "import_jobs", "id", "CASCADE"],
  ["import_remediations", "import_job_id", "import_jobs", "id", "CASCADE"],
  ["import_remediations", "actor_user_id", "users", "id", "RESTRICT"],
  ["import_remediations", "supersedes_remediation_id", "import_remediations", "id", "RESTRICT"],
  ["departmental_materialization_operations", "import_job_id", "import_jobs", "id", "RESTRICT"],
  ["departmental_materialization_operations", "actor_user_id", "users", "id", "RESTRICT"],
  ["departmental_planning_records", "operation_id", "departmental_materialization_operations", "operation_id", "CASCADE"],
  ["departmental_planning_records", "import_job_id", "import_jobs", "id", "RESTRICT"]
].map(([table, from, toTable, to, onDelete]) => ({ table, from, to: `${toTable}.${to}`, onDelete }));

const requiredConstraintFragments: Record<string, string[]> = {
  strategic_goals: ["foreign key(owner_person_id)references people(id)on delete restrict"],
  departments: ["unique", "check(active in (0,1))"],
  seats: ["unique", "foreign key(department_id)references departments(id)on delete restrict"],
  sub_goals: ["unique(goal_id,title)", "foreign key(goal_id)references strategic_goals(id)on delete restrict"],
  work_items: ["check(progress between 0 and 100)"],
  work_item_assignments: ["check(raci_type in ('r','a','c','i'))", "check(target_type in ('department','position','person','unresolved'))", "foreign key(work_item_id)references work_items(id)on delete cascade"],
  work_item_collaborators: ["primary key(work_item_id,person_id)"],
  dependencies: ["unique(source_work_item_id,target_work_item_id)", "check(source_work_item_id<>target_work_item_id)"],
  monthly_reviews: ["unique(month_key,department_id)"],
  activities: ["unique(sub_goal_id,title)"],
  app_roles: ["unique", "check(scope in ('company','department','own'))"],
  permissions: ["unique"],
  users: ["unique"],
  role_permissions: ["primary key(role_id,permission_id)"],
  import_records: ["primary key(job_id,id)"],
  import_analysis_revisions: ["unique(import_job_id,revision)"],
  pulse_release_metadata: ["primary key", "check(id=1)"]
};

function normalizeSql(sql: string): string {
  return sql.toLowerCase().replace(/["`]/g, "").replace(/\s+/g, "");
}

export function schemaContractErrors(database: Database.Database): string[] {
  const errors: string[] = [];
  const objects = database.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type IN ('table', 'index', 'trigger')").all() as Array<{ type: string; name: string; tbl_name: string; sql: string | null }>;
  const tables = new Map(objects.filter((object) => object.type === "table").map((object) => [object.name, object]));
  const indexes = new Set(objects.filter((object) => object.type === "index").map((object) => object.name));
  const triggers = new Set(objects.filter((object) => object.type === "trigger").map((object) => object.name));

  for (const table of requiredTables) {
    const object = tables.get(table);
    if (!object) {
      errors.push(`missing table "${table}"`);
      continue;
    }
    const actualColumns = new Map(
      (database.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null }>)
        .map((column) => [column.name, column])
    );
    for (const [name, expected] of Object.entries(requiredColumns[table] ?? {})) {
      const actual = actualColumns.get(name);
      if (!actual) {
        errors.push(`missing column "${table}.${name}"`);
        continue;
      }
      if (actual.type.toUpperCase() !== expected.type) errors.push(`column type drift "${table}.${name}"`);
      if (expected.notNull !== undefined && Boolean(actual.notnull) !== expected.notNull) errors.push(`column nullability drift "${table}.${name}"`);
      if (expected.defaultValue !== undefined && normalizeSql(actual.dflt_value ?? "") !== normalizeSql(expected.defaultValue)) {
        errors.push(`column default drift "${table}.${name}"`);
      }
    }
    const sql = normalizeSql(object.sql ?? "");
    for (const fragment of requiredConstraintFragments[table] ?? []) {
      if (!sql.includes(normalizeSql(fragment))) errors.push(`missing constraint on "${table}"`);
    }
  }

  for (const index of requiredIndexes) if (!indexes.has(index)) errors.push(`missing index "${index}"`);
  for (const trigger of requiredTriggers) if (!triggers.has(trigger)) errors.push(`missing trigger "${trigger}"`);

  for (const foreignKey of requiredForeignKeys) {
    const [toTable, toColumn] = foreignKey.to.split(".");
    const actual = (database.prepare(`PRAGMA foreign_key_list("${foreignKey.table}")`).all() as Array<{ from: string; table: string; to: string; on_delete: string }>)
      .some((candidate) => candidate.from === foreignKey.from && candidate.table === toTable && candidate.to === toColumn && candidate.on_delete.toUpperCase() === foreignKey.onDelete);
    if (!actual) errors.push(`missing foreign key "${foreignKey.table}.${foreignKey.from} -> ${foreignKey.to}"`);
  }
  return errors;
}
