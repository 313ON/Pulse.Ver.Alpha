PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS strategic_goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  owner_person_id TEXT,
  plan_year INTEGER NOT NULL DEFAULT 1405 CHECK (plan_year = 1405),
  FOREIGN KEY (owner_person_id) REFERENCES people(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS seats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL UNIQUE,
  department_id TEXT NOT NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  seat_id TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sub_goals (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  title TEXT NOT NULL,
  owner_person_id TEXT,
  UNIQUE (goal_id, title),
  FOREIGN KEY (goal_id) REFERENCES strategic_goals(id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_person_id) REFERENCES people(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE CHECK (public_id GLOB 'G[0-9][0-9]-O[0-9][0-9]-A[0-9][0-9]-T[0-9][0-9][0-9]'),
  goal_id TEXT NOT NULL,
  sub_goal_id TEXT,
  department_id TEXT NOT NULL,
  owner_person_id TEXT NOT NULL,
  title TEXT NOT NULL,
  work_type TEXT NOT NULL CHECK (work_type IN ('پروژه','اقدام','فعالیت تکرارشونده','پایش KPI','Milestone')),
  deliverable TEXT NOT NULL CHECK (length(trim(deliverable)) > 0),
  status TEXT NOT NULL DEFAULT 'شروع نشده' CHECK (status IN ('شروع نشده','در حال اجرا','تکمیل شده','مسدود','لغو شده')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  planned_start TEXT NOT NULL,
  planned_end TEXT NOT NULL,
  actual_completion TEXT,
  priority TEXT,
  blocker TEXT,
  notes TEXT,
  plan_year INTEGER NOT NULL DEFAULT 1405 CHECK (plan_year = 1405),
  UNIQUE (goal_id, title),
  CHECK (planned_end >= planned_start),
  CHECK ((status = 'تکمیل شده' AND progress = 100) OR status <> 'تکمیل شده'),
  FOREIGN KEY (goal_id) REFERENCES strategic_goals(id) ON DELETE RESTRICT,
  FOREIGN KEY (sub_goal_id) REFERENCES sub_goals(id) ON DELETE RESTRICT,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_person_id) REFERENCES people(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS work_item_collaborators (
  work_item_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  PRIMARY KEY (work_item_id, person_id),
  FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS kpis (
  id TEXT PRIMARY KEY,
  work_item_id TEXT,
  name TEXT NOT NULL,
  definition TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('شاخص خروجی','شاخص نتیجه')),
  unit TEXT,
  baseline REAL,
  target REAL NOT NULL,
  actual REAL NOT NULL,
  direction TEXT NOT NULL DEFAULT 'higher-is-better' CHECK (direction IN ('higher-is-better','lower-is-better')),
  frequency TEXT,
  owner_person_id TEXT NOT NULL,
  FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_person_id) REFERENCES people(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS risks (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  work_item_id TEXT,
  title TEXT NOT NULL,
  probability INTEGER NOT NULL CHECK (probability BETWEEN 1 AND 5),
  impact INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5),
  owner_person_id TEXT NOT NULL,
  response_action TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'باز' CHECK (status IN ('باز','کنترل‌شده','بسته')),
  FOREIGN KEY (goal_id) REFERENCES strategic_goals(id) ON DELETE RESTRICT,
  FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_person_id) REFERENCES people(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS dependencies (
  id TEXT PRIMARY KEY,
  source_work_item_id TEXT NOT NULL,
  target_work_item_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'باز' CHECK (status IN ('باز','حل‌شده')),
  delay_days INTEGER NOT NULL DEFAULT 0 CHECK (delay_days >= 0),
  notes TEXT,
  UNIQUE (source_work_item_id, target_work_item_id),
  CHECK (source_work_item_id <> target_work_item_id),
  FOREIGN KEY (source_work_item_id) REFERENCES work_items(id) ON DELETE RESTRICT,
  FOREIGN KEY (target_work_item_id) REFERENCES work_items(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS monthly_reviews (
  id TEXT PRIMARY KEY,
  month_key TEXT NOT NULL,
  department_id TEXT NOT NULL,
  plan_summary TEXT,
  actual_summary TEXT,
  deviation TEXT,
  root_cause TEXT,
  corrective_action TEXT,
  management_decision TEXT,
  next_month_commitment TEXT,
  UNIQUE (month_key, department_id),
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS work_items_goal_idx ON work_items(goal_id);
CREATE INDEX IF NOT EXISTS work_items_owner_idx ON work_items(owner_person_id);
CREATE INDEX IF NOT EXISTS work_items_due_idx ON work_items(planned_end);
CREATE INDEX IF NOT EXISTS risks_severity_idx ON risks(probability, impact);
