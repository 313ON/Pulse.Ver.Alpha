import type Database from "better-sqlite3";

export const PULSE_RELEASE_NAME = "PULSE Release 1";
export const PULSE_APPLICATION_VERSION = "1.0.0";
export const PULSE_SCHEMA_VERSION = "1";

export function currentReleaseCommit(): string {
  return process.env.PULSE_RELEASE_COMMIT?.trim() || "unrecorded";
}

export function ensureReleaseMetadata(database: Database.Database): void {
  database.prepare(`
    INSERT INTO pulse_release_metadata
      (id, release_name, application_version, schema_version, released_commit)
    VALUES
      (1, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      release_name = excluded.release_name,
      application_version = excluded.application_version,
      schema_version = excluded.schema_version,
      released_commit = excluded.released_commit,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    PULSE_RELEASE_NAME,
    PULSE_APPLICATION_VERSION,
    PULSE_SCHEMA_VERSION,
    currentReleaseCommit()
  );
}

export function getReleaseMetadata(database: Database.Database) {
  return database.prepare(`
    SELECT release_name AS releaseName,
           application_version AS applicationVersion,
           schema_version AS schemaVersion,
           released_commit AS releasedCommit,
           updated_at AS updatedAt
    FROM pulse_release_metadata
    WHERE id = 1
  `).get() as {
    releaseName: string;
    applicationVersion: string;
    schemaVersion: string;
    releasedCommit: string;
    updatedAt: string;
  } | undefined;
}
