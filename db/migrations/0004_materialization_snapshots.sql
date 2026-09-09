-- R10-F: immutable approved materialization snapshots.
-- Existing R10-D operations intentionally remain legacy/non-reconstructable.

CREATE TABLE IF NOT EXISTS materialization_snapshots (
  operation_id TEXT PRIMARY KEY,
  snapshot_version INTEGER NOT NULL CHECK (snapshot_version = 2),
  import_job_id TEXT NOT NULL,
  approved_analysis_revision INTEGER NOT NULL CHECK (approved_analysis_revision > 0),
  source_snapshot_hash TEXT NOT NULL,
  plan_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (operation_id) REFERENCES materialization_operations(operation_id) ON DELETE RESTRICT,
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS materialization_snapshots_identity_idx
  ON materialization_snapshots(import_job_id, approved_analysis_revision, source_snapshot_hash);

CREATE TRIGGER IF NOT EXISTS materialization_snapshots_immutable_update
BEFORE UPDATE ON materialization_snapshots
BEGIN
  SELECT RAISE(ABORT, 'materialization_snapshots is append-only');
END;

CREATE TRIGGER IF NOT EXISTS materialization_snapshots_immutable_delete
BEFORE DELETE ON materialization_snapshots
BEGIN
  SELECT RAISE(ABORT, 'materialization_snapshots is append-only');
END;
