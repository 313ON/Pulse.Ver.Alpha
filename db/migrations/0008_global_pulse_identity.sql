CREATE TABLE IF NOT EXISTS pulse_entity_identities (
  technical_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  pulse_identifier TEXT NOT NULL UNIQUE,
  external_source_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS pulse_entity_identities_type_idx ON pulse_entity_identities(entity_type);

CREATE TRIGGER IF NOT EXISTS pulse_entity_identities_immutable_update
BEFORE UPDATE OF pulse_identifier ON pulse_entity_identities
BEGIN
  SELECT RAISE(ABORT, 'PULSE identifiers are immutable');
END;

CREATE TRIGGER IF NOT EXISTS pulse_entity_identities_immutable_delete
BEFORE DELETE ON pulse_entity_identities
BEGIN
  SELECT RAISE(ABORT, 'PULSE identities are append-only');
END;
