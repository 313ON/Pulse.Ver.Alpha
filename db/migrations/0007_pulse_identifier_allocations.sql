CREATE TABLE IF NOT EXISTS pulse_identifier_allocations (
  allocation_key TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('goal', 'action')),
  last_value INTEGER NOT NULL CHECK (last_value >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS pulse_identifier_allocations_updated_at
AFTER UPDATE ON pulse_identifier_allocations
BEGIN
  UPDATE pulse_identifier_allocations SET updated_at = CURRENT_TIMESTAMP WHERE allocation_key = NEW.allocation_key;
END;
