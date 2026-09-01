# PULSE departmental import — production acceptance

Date: 2026-08-31

## Result

`PASS WITH WARNINGS`

The real application materialization route now dispatches explicitly classified
departmental/supporting imports to the departmental materializer. The missing
authoritative IT workbook remains an IT-canonical authority blocker only.

## Orchestration

`POST /api/imports/[id]/materializations`
→ authenticated session and CSRF
→ `imports.materialize.request` + `imports.materialize.execute`
→ approved import lookup
→ immutable `createImportSnapshotReference`
→ provenance and source-fingerprint validation
→ transactional departmental operation/record persistence
→ audit event.

The existing canonical route remains unchanged for canonical materialization.

## Source inventory

| Workbook | Classification | Domain | Records |
|---|---|---:|---:|
| Annual program supplies - برنامه سال 1405 - تدارکات -اصلاحی (1).xlsx | SUPPORTING | procurement | included |
| برنامه سال 1405 واحد نت با تفکیک اقدامات.xlsx | DERIVED | maintenance/NET | included |
| برنامه سال 1405 آقای عبودی.xlsx | DERIVED | production | included |
| پیش نویس برنامه سالیانه 1405 واحد اداری (1).xlsx | DERIVED | administration | included |

Runtime-validation copies were not imported. Supplies remained supporting and
did not contribute canonical IT goals.

## Persistent acceptance evidence

- Database: isolated file-backed SQLite in the OS temporary directory; removed
  after the test.
- Departmental/supporting records before reopen: `3,053`.
- Departmental/supporting records after reopen: `3,053`.
- Materialization operations: `4`.
- Canonical baseline remained: `10 strategic_goals / 0 added IT objectives /
  0 added IT activities / 0 added IT actions`; the isolated baseline contains
  its normal 6 seeded work items.
- Identity manifest remained: `10 units / 32 roles / 5 validated aliases`.
  The isolated runtime baseline remains unchanged; these manifest identity
  counts are not a claim that runtime `departments` or `seats` have one-row
  parity with the imported identity workbook.
- Provenance: all accepted source records had complete cell provenance before
  insertion; persisted provenance is stored in `provenance_json`.

## Idempotency and source duplication

- Same approved snapshot: `PASS`; repeated materialization returns the existing
  operation and inserts no records.
- Separate import job for the same logical workbook: `PASS`; stable
  `source_fingerprint` rejects the duplicate before insertion.
- Legitimate repeated planning rows remain distinct because records are keyed by
  `(import_job_id, source_record_id)`, not visible text.

## Security and failure tests

- Authorized active super-admin actor: `PASS`.
- Missing/inactive actor: `PASS` rejection.
- Unauthorized actor: `PASS` rejection.
- Unapproved import: `PASS` rejection.
- Incomplete provenance: `PASS` rejection before transaction.
- Controlled insertion failure: `PASS`; operation and records both rolled back.
- Classification is read from the approved server-side import job, not accepted
  as a materialization request field.

## Validation

- Focused departmental acceptance: `PASS`.
- Persistent acceptance, reopen, duplicate-source, authorization, provenance,
  and rollback tests: `PASS` (3 tests).
- Full suite: `PASS` — 52 files, 296 tests.
- Typecheck: `PASS`.
- Lint: `PASS`.
- Build: `PASS`.
- Canonical isolation: `PASS`; no departmental writes target canonical tables.
- Schema contract: updated with departmental tables, foreign keys, fingerprint
  column, and index.

## Warnings

- No HTTP-level integration test currently drives the Next.js route with a real
  session/cookie; service-level authorization and route permission calls are
  covered by the existing RBAC path.
- Existing legacy databases that already contain departmental operations require
  the idempotent runtime column repair; a fresh database uses the complete
  schema directly.
- IT canonical import remains blocked until accepted IT authority is supplied.

## Files changed in this phase

- `db/schema.sqlite.sql`
- `src/server/schema-contract.ts`
- `src/server/db.ts`
- `src/application/materialization/snapshot.ts`
- `src/application/materialization/departmental.ts`
- `src/app/api/imports/[id]/materializations/route.ts`
- `src/application/materialization/departmental.production.acceptance.test.ts`
- `artifacts/import/pulse-departmental-import.production-acceptance.report.md`

`SOURCE WORKBOOKS CHANGED: NO`
