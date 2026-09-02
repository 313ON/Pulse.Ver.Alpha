-- Canonical departmental goals bridge organizational strategic goals to objectives.
CREATE TABLE IF NOT EXISTS departmental_goals (
  id TEXT PRIMARY KEY,
  strategic_goal_id TEXT NOT NULL,
  department_id TEXT,
  title TEXT NOT NULL,
  owner_person_id TEXT,
  plan_year INTEGER NOT NULL,
  UNIQUE (strategic_goal_id, department_id, title, plan_year),
  FOREIGN KEY (strategic_goal_id) REFERENCES strategic_goals(id) ON DELETE RESTRICT,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_person_id) REFERENCES people(id) ON DELETE RESTRICT
);

ALTER TABLE sub_goals ADD COLUMN departmental_goal_id TEXT REFERENCES departmental_goals(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS departmental_goals_strategic_idx ON departmental_goals(strategic_goal_id);
CREATE INDEX IF NOT EXISTS sub_goals_departmental_idx ON sub_goals(departmental_goal_id);
