# ADR-016: Windows SQLite Operational Baseline

- Status: Accepted
- Date: 2026-08-22

## Decision

PULSE continues to use one externally persisted SQLite database and one
application writer process. The runtime applies this configuration to every
database connection:

- `journal_mode=WAL` for file databases
- `synchronous=FULL`
- `foreign_keys=ON`
- `busy_timeout=5000`
- `wal_autocheckpoint=1000`
- `locking_mode=NORMAL`
- `temp_store=DEFAULT`

WAL is intentionally not requested for `:memory:` test databases.

`synchronous=FULL` is selected because durability is prioritized over the
small write-latency reduction of `NORMAL`. WAL permits readers to continue
while a writer commits, but the deployment still uses a single writer process.

## Connection scope

`journal_mode=WAL` is persistent in the database file. The remaining runtime
settings are applied on each writable and read-only connection because they
are connection-local or connection-sensitive.

Read-only connections never attempt to change journal mode or initialize
schema. They apply only connection-local read settings and require the file to
exist.

## Concurrency

Concurrent startup is permitted to converge through SQLite locking, the
finite busy timeout, idempotent canonical schema creation, transactional
baseline seeding, and transactional/idempotent authentication seeding.
Deployment must still run only one application writer process per database.

## Backup and restore

Backups use SQLite online backup semantics and are verified with integrity,
foreign-key, and schema-contract checks before retention. Raw copying of only
the main database file while WAL is active is not an approved procedure.

## Rollback

Application rollback is safe only when the previous application understands
the current schema. There are no destructive down-migrations. If a schema
rollback is required, restore a verified database backup during a controlled
maintenance window.
