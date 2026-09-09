-- Immutable server-derived plan for an approved import identity.

CREATE TABLE IF NOT EXISTS approved_materialization_snapshots (
  import_job_id TEXT NOT NULL,
  approved_analysis_revision INTEGER NOT NULL CHECK (approved_analysis_revision > 0),
  source_snapshot_hash TEXT NOT NULL,
  plan_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (import_job_id, approved_analysis_revision, source_snapshot_hash),
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE RESTRICT
);

CREATE TRIGGER IF NOT EXISTS approved_materialization_snapshots_immutable_update
BEFORE UPDATE ON approved_materialization_snapshots
BEGIN
  SELECT RAISE(ABORT, 'approved_materialization_snapshots is append-only');
END;

CREATE TRIGGER IF NOT EXISTS approved_materialization_snapshots_immutable_delete
BEFORE DELETE ON approved_materialization_snapshots
BEGIN
  SELECT RAISE(ABORT, 'approved_materialization_snapshots is append-only');
END;
