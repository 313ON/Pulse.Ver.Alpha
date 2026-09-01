-- R10-B: durable materialization operation state, mappings, and provenance.
-- This migration is opt-in. It is not loaded by the R9 runtime schema path.

CREATE TABLE IF NOT EXISTS materialization_operations (
  operation_id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL,
  approved_analysis_revision INTEGER NOT NULL CHECK (approved_analysis_revision > 0),
  source_snapshot_hash TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  target_plan_year INTEGER NOT NULL CHECK (target_plan_year > 0),
  status TEXT NOT NULL CHECK (status IN ('REQUESTED', 'VALIDATING', 'READY', 'EXECUTING', 'COMPLETED', 'REJECTED', 'FAILED')),
  requested_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  failure_reason TEXT,
  goal_count INTEGER NOT NULL DEFAULT 0 CHECK (goal_count >= 0),
  objective_count INTEGER NOT NULL DEFAULT 0 CHECK (objective_count >= 0),
  activity_count INTEGER NOT NULL DEFAULT 0 CHECK (activity_count >= 0),
  work_item_count INTEGER NOT NULL DEFAULT 0 CHECK (work_item_count >= 0),
  provenance_count INTEGER NOT NULL DEFAULT 0 CHECK (provenance_count >= 0),
  goal_reused_count INTEGER NOT NULL DEFAULT 0 CHECK (goal_reused_count >= 0),
  objective_reused_count INTEGER NOT NULL DEFAULT 0 CHECK (objective_reused_count >= 0),
  activity_reused_count INTEGER NOT NULL DEFAULT 0 CHECK (activity_reused_count >= 0),
  work_item_reused_count INTEGER NOT NULL DEFAULT 0 CHECK (work_item_reused_count >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (import_job_id, approved_analysis_revision, source_snapshot_hash),
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE RESTRICT,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS materialization_entity_map (
  operation_id TEXT NOT NULL,
  import_job_id TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  canonical_entity_type TEXT NOT NULL CHECK (canonical_entity_type IN ('goal', 'objective', 'activity', 'action')),
  canonical_entity_id TEXT NOT NULL,
  logical_identity_key TEXT NOT NULL,
  mapping_status TEXT NOT NULL CHECK (mapping_status IN ('CREATED', 'REUSED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (operation_id, source_record_id, canonical_entity_type, canonical_entity_id),
  FOREIGN KEY (operation_id) REFERENCES materialization_operations(operation_id) ON DELETE CASCADE,
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS canonical_provenance (
  provenance_id TEXT PRIMARY KEY,
  canonical_entity_type TEXT NOT NULL CHECK (canonical_entity_type IN ('goal', 'objective', 'activity', 'action')),
  canonical_entity_id TEXT NOT NULL,
  import_job_id TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_workbook TEXT NOT NULL,
  source_sheet TEXT,
  source_row INTEGER,
  source_cell TEXT,
  semantic_type TEXT,
  provenance_json TEXT NOT NULL,
  first_created_operation_id TEXT NOT NULL,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('CREATED_FROM', 'CONTRIBUTED_TO', 'REUSED_FROM')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE RESTRICT,
  FOREIGN KEY (first_created_operation_id) REFERENCES materialization_operations(operation_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS materialization_operations_import_idx
  ON materialization_operations(import_job_id, created_at);
CREATE INDEX IF NOT EXISTS materialization_operations_status_idx
  ON materialization_operations(status, updated_at);
CREATE INDEX IF NOT EXISTS materialization_entity_map_source_idx
  ON materialization_entity_map(import_job_id, source_record_id);
CREATE INDEX IF NOT EXISTS materialization_entity_map_canonical_idx
  ON materialization_entity_map(canonical_entity_type, canonical_entity_id);
CREATE INDEX IF NOT EXISTS materialization_entity_map_operation_idx
  ON materialization_entity_map(operation_id);
CREATE INDEX IF NOT EXISTS canonical_provenance_source_idx
  ON canonical_provenance(import_job_id, source_record_id);
CREATE INDEX IF NOT EXISTS canonical_provenance_canonical_idx
  ON canonical_provenance(canonical_entity_type, canonical_entity_id);
CREATE INDEX IF NOT EXISTS canonical_provenance_operation_idx
  ON canonical_provenance(first_created_operation_id);

CREATE TRIGGER IF NOT EXISTS canonical_provenance_immutable_update
BEFORE UPDATE ON canonical_provenance
BEGIN
  SELECT RAISE(ABORT, 'canonical_provenance is append-only');
END;

CREATE TRIGGER IF NOT EXISTS canonical_provenance_immutable_delete
BEFORE DELETE ON canonical_provenance
BEGIN
  SELECT RAISE(ABORT, 'canonical_provenance is append-only');
END;
