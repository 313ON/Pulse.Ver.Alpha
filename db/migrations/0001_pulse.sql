-- PULSE relational baseline. Operational records are scoped to plan_year = 1405.
create extension if not exists pgcrypto;
create table strategic_goals (
  id varchar(8) primary key,
  title text not null,
  owner_person_id uuid,
  plan_year smallint not null default 1405,
  created_at timestamptz not null default now(),
  check (plan_year = 1405)
);
create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true
);
create table seats (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  department_id uuid references departments(id)
);
create table people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  seat_id uuid references seats(id),
  active boolean not null default true
);
alter table strategic_goals add constraint strategic_goals_owner_fk foreign key (owner_person_id) references people(id);
create table sub_goals (
  id uuid primary key default gen_random_uuid(),
  goal_id varchar(8) not null references strategic_goals(id),
  title text not null,
  owner_person_id uuid references people(id)
);
create table work_items (
  id uuid primary key default gen_random_uuid(),
  public_id varchar(32) not null unique,
  goal_id varchar(8) not null references strategic_goals(id) on delete restrict,
  sub_goal_id uuid references sub_goals(id),
  department_id uuid not null references departments(id) on delete restrict,
  owner_person_id uuid not null references people(id) on delete restrict,
  title text not null,
  work_type varchar(32) not null check (work_type in ('پروژه','اقدام','فعالیت تکرارشونده','پایش KPI','Milestone')),
  deliverable text not null check (length(trim(deliverable)) > 0),
  status varchar(24) not null default 'شروع نشده' check (status in ('شروع نشده','در حال اجرا','تکمیل شده','مسدود','لغو شده')),
  progress smallint not null default 0 check (progress between 0 and 100),
  planned_start date not null,
  planned_end date not null,
  actual_completion date,
  priority varchar(12),
  blocker text,
  notes text,
  plan_year smallint not null default 1405 check (plan_year = 1405),
  created_at timestamptz not null default now(),
  check (public_id ~ '^G[0-9]{2}-O[0-9]{2}-A[0-9]{2}-T[0-9]{3}$'),
  check (planned_end >= planned_start),
  check ((status = 'تکمیل شده' and progress = 100) or status <> 'تکمیل شده'),
  unique (goal_id, title)
);
create table work_item_collaborators (
  work_item_id uuid not null references work_items(id) on delete cascade,
  person_id uuid not null references people(id) on delete restrict,
  primary key (work_item_id, person_id)
);
create table kpis (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references work_items(id) on delete restrict,
  name text not null,
  definition text,
  kind varchar(16) not null check (kind in ('شاخص خروجی','شاخص نتیجه')),
  unit text,
  baseline numeric,
  target numeric,
  actual numeric,
  frequency varchar(24),
  owner_person_id uuid not null references people(id) on delete restrict
);
create table risks (
  id uuid primary key default gen_random_uuid(),
  goal_id varchar(8) not null references strategic_goals(id) on delete restrict,
  work_item_id uuid not null references work_items(id) on delete restrict,
  title text not null,
  probability smallint not null check (probability between 1 and 5),
  impact smallint not null check (impact between 1 and 5),
  severity smallint generated always as (probability * impact) stored,
  owner_person_id uuid not null references people(id) on delete restrict,
  response_action text,
  due_date date,
  status varchar(20) not null default 'باز'
);
create table dependencies (
  id uuid primary key default gen_random_uuid(),
  source_work_item_id uuid not null references work_items(id) on delete restrict,
  target_work_item_id uuid not null references work_items(id) on delete restrict,
  status varchar(20) not null default 'باز' check (status in ('باز','حل‌شده')),
  delay_days integer not null default 0 check (delay_days >= 0),
  notes text,
  check (source_work_item_id <> target_work_item_id),
  unique (source_work_item_id, target_work_item_id)
);
create table monthly_reviews (
  id uuid primary key default gen_random_uuid(),
  month_key varchar(7) not null,
  department_id uuid not null references departments(id) on delete restrict,
  plan_summary text,
  actual_summary text,
  deviation text,
  root_cause text,
  corrective_action text,
  management_decision text,
  next_month_commitment text,
  unique (month_key, department_id)
);
create index work_items_goal_idx on work_items(goal_id);
create index work_items_owner_idx on work_items(owner_person_id);
create index work_items_due_idx on work_items(planned_end);
create index risks_severity_idx on risks(severity);
