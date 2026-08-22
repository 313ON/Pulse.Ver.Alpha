# ADR-015: SQLite Persistence Schema Authority

- Status: Accepted
- Date: 2026-08-22

## Decision

SQLite is the sole persistence engine for the current PULSE runtime.

`db/schema.sqlite.sql` is the canonical SQLite schema contract. It contains
the operational, activity, authentication/RBAC, audit, and import-persistence
tables, indexes, triggers, foreign keys, defaults, and critical constraints.

`src/server/db.ts` applies `ensurePhaseFiveSchema()` only as an idempotent
compatibility repair for legacy databases whose supported columns are absent.
The compatibility path must not delete data, downgrade schema, or silently
change existing values.

Readiness validates SQLite integrity and the live schema contract, including
tables, columns, indexes, triggers, foreign keys, defaults, and critical
constraint fragments. Readiness remains fail-closed.

## Scope

Production databases remain external to the application release directory and
are selected by an absolute `PULSE_DB_PATH`. The developer fallback remains
`db/pulse.sqlite`.

No PostgreSQL runtime or migration is introduced by this decision.

## PostgreSQL artifact

`db/migrations/0001_pulse.sql` is retained as a historical / abandoned
PostgreSQL-oriented artifact. Git history and repository evidence show no
runtime, package, deployment, or CI path that executes it. It is not
authoritative for SQLite persistence.

## Consequences

- Fresh databases receive the complete schema from the checked-in SQLite file.
- Existing databases retain a compatibility repair path.
- Incomplete or drifted databases fail readiness rather than appearing healthy.
- Windows SQLite locking, WAL, service-account ACLs, and backup/restore remain
  operational work required before a production GO decision.
