-- D-001: pin the approved departmental source before writing materialized records.

CREATE TABLE IF NOT EXISTS departmental_materialization_snapshots (
  operation_id TEXT PRIMARY KEY,
  snapshot_version INTEGER NOT NULL CHECK (snapshot_version = 1),
  import_job_id TEXT NOT NULL,
  approved_analysis_revision INTEGER NOT NULL CHECK (approved_analysis_revision > 0),
  source_snapshot_hash TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (import_job_id, approved_analysis_revision, source_snapshot_hash),
  FOREIGN KEY (operation_id) REFERENCES departmental_materialization_operations(operation_id) ON DELETE RESTRICT,
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE RESTRICT
);

CREATE TRIGGER IF NOT EXISTS departmental_materialization_snapshots_immutable_update
BEFORE UPDATE ON departmental_materialization_snapshots
BEGIN
  SELECT RAISE(ABORT, 'departmental_materialization_snapshots is append-only');
END;

CREATE TRIGGER IF NOT EXISTS departmental_materialization_snapshots_immutable_delete
BEFORE DELETE ON departmental_materialization_snapshots
BEGIN
  SELECT RAISE(ABORT, 'departmental_materialization_snapshots is append-only');
END;
