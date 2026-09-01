# PULSE — Legacy `source_fingerprint` Repair Acceptance

## STATUS

`PASS`

## LEGACY FIXTURE

- Isolated file-backed SQLite path:
  `%TEMP%\pulse-legacy-fingerprint-<run-id>.sqlite`
- The fixture was created from the current schema, then reduced to the
  representative pre-fingerprint state.
- `departmental_materialization_operations.source_fingerprint` was absent.
- The named fingerprint index was absent.
- Existing data included one department, one import job, one user, one approved
  materialization operation, and the legacy source snapshot value
  `legacy-fingerprint`.
- Production `db/pulse.sqlite` and source workbooks were not accessed.

## REPAIR

The runtime database boundary detects an existing departmental operations table
without `source_fingerprint`. It temporarily omits the current fingerprint
index statement, then performs the repair in a SQLite transaction:

1. add `source_fingerprint TEXT NOT NULL DEFAULT ''`;
2. backfill empty values from `source_snapshot_hash`;
3. create the named unique index.

Catalog evidence after first initialization:

- `source_fingerprint`: `TEXT`, `NOT NULL`, default `''`;
- `departmental_materialization_source_fingerprint_idx`: present,
  `UNIQUE`;
- foreign keys to `import_jobs(id)` and `users(id)`: present with `RESTRICT`;
- schema contract: no errors;
- no duplicate fingerprint column or index.

## DATA PRESERVATION

| Data | Before | After repair |
|---|---:|---:|
| Departments | 1 | 1 |
| Import jobs | 1 | 1 |
| Users | 1 | 1 |
| Materialization operations | 1 | 1 |

The representative operation remained
`legacy-operation / legacy-import / legacy-fingerprint`; no existing values
were changed and no unrelated catalog objects disappeared.

## IDEMPOTENCY

`PASS` — closing and reopening the same repaired database produced the same
catalog state, one fingerprint column, one fingerprint index, unchanged data
counts, and no startup failure.

## FINGERPRINT SEMANTICS

- Same fingerprint: `PASS` — unique-index insertion rejected.
- Different fingerprint: `PASS` — distinct operation accepted.
- NULL fingerprint: `PASS` — `NOT NULL` insertion rejected.
- Legacy values: `PASS` — existing NULL/absent legacy state is deterministically
  backfilled from `source_snapshot_hash`, following the established
  source-fingerprint policy.

Duplicate legacy snapshot values were also tested. Repair failed safely rather
than creating ambiguous fingerprints.

## MATERIALIZATION

`PASS` — after repair, an approved supporting workbook materialized
successfully with 500 departmental records; the operation returned a persisted
64-character source fingerprint, repeat materialization returned
`duplicate: true`, and all 500 records retained provenance.

Canonical IT remained:

`0 / 0 / 0 / 0`

## FAILURE SAFETY

`PASS` — when two legacy rows would backfill to the same unique fingerprint,
initialization failed deterministically. The transactional repair left the
legacy schema without a partial fingerprint column and preserved both original
rows.

## CONCURRENCY

`WARNING` — the repair is transactional and uses SQLite WAL/busy-timeout
locking, so no fingerprint-specific race was demonstrated. A dedicated
multi-process legacy-repair harness was not added; the existing Windows
temporary-directory concurrency issue was not reopened. This is not a blocker.

## TESTS

- Legacy repair acceptance: `PASS` — 1 file, 2 tests.
- Departmental materialization, HTTP, persistence, security, and rollback
  focused tests: `PASS` — 7 files, 40 tests.
- Full suite: `PASS` — 54 files, 301 tests.
- Typecheck: `PASS`.
- Lint: `PASS`.
- Build: `PASS`.

## RELEASE DECISION

`RELEASE READY`

