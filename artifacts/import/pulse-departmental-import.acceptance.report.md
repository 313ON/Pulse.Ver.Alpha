# PULSE Departmental Import Acceptance

## Status

`PARTIAL PASS`

Departmental/supporting planning imports succeeded while canonical IT planning remains blocked because the accepted IT authority is unavailable.

## Workbook inventory

| Workbook | Domain | Classification | Authority | Sheets | Duplicate handling |
|---|---|---|---|---:|---|
| `Annual program supplies - برنامه سال 1405 - تدارکات -اصلاحی (1).xlsx` | Procurement | `SUPPORTING` | Not canonical IT | 1 | Imported once |
| `برنامه سال 1405 واحد نت با تفکیک اقدامات.xlsx` | Maintenance/NET | `DERIVED` | Not canonical IT | 3 | Imported once |
| `برنامه سال 1405 آقای عبودی.xlsx` | Production | `DERIVED` | Not canonical IT | 1 | Imported once |
| `پیش نویس برنامه سالیانه 1405 واحد اداری (1).xlsx` | Administration | `DERIVED` | Not canonical IT | 1 | Imported once |
| `.runtime-validation/**/workbook-copy.xlsx` | Maintenance/NET copies | Duplicate | Not canonical IT | 3 each | Excluded; duplicate source fingerprint |
| `- 1404ورژن 7 خرداد.xlsx` | Identity/reference | `REFERENCE` | Identity only | 23 | Not a 1405 planning import |

## Import jobs

Four isolated import jobs were created in the acceptance test using the existing lifecycle:

`Workbook → Parse → Classify → Stage → Validate → Approve → Materialize`

Each job was approved through `ImportReviewService`; no direct canonical-table writes were used.

## Manifest

- Path: `artifacts/import/pulse-import-manifest.json`
- Version: `1.0` (backward-compatible extension)
- Canonical planning source: unavailable
- Departmental sources: recorded with domain, classification, duplicate status, and canonical contribution `NO`
- Identity records preserved: 10 Units, 32 Roles, 5 Aliases
- Supplies source remains `SUPPORTING`

## Counts

- Staged records: `3,053`
- Approved jobs: `4`
- Materialized departmental records: `3,053`
- Materialized departmental operations: `4`
- Materialized provenance-bearing records: `3,053`
- Canonical Goals: `0`
- Canonical Objectives: `0`
- Canonical Activities: `0`
- Canonical Actions: `0`

The departmental record count is the sum of mapped records from the four distinct workbooks. Runtime-validation copies did not add records.

## Materialization design

Departmental records are stored in:

- `departmental_materialization_operations`
- `departmental_planning_records`

The operation key is:

`import_job_id + approved_analysis_revision + source_snapshot_hash`

Each record preserves classification, domain, entity type, normalized data, raw record JSON, source workbook, sheet, row, cell, and complete provenance JSON. Materialization is transactional and idempotent.

## Validation

- Schema validity: `PASS` — TypeScript typecheck passed; schema contract includes departmental tables.
- Parse and mapping: `PASS` — four real 1405 workbooks parsed with `XlsxWorkbookReader` and `SpreadsheetMappingEngine`.
- Classification: `PASS` — source classifications were preserved; no departmental source entered canonical planning.
- Approval lifecycle: `PASS` — all four jobs reached `APPROVED` through `ImportReviewService`.
- Provenance: `PASS` — all 3,053 materialized records retained non-empty provenance JSON.
- Canonical boundary: `PASS` — canonical tables remained `0 / 0 / 0 / 0`.
- Duplicate protection: `PASS` — each materialized job was repeated and returned `duplicate: true`; runtime copies were excluded.
- Idempotency: `PASS` — four operations for four unique source jobs, with no duplicate departmental records.
- Identity preservation: `PASS` — existing 10 Units / 32 Roles / 5 Aliases were not overwritten.
- Transaction safety: `PASS` — materialization uses a SQLite transaction and immutable source snapshot.
- Existing full test suite: `FAIL — 49 test files passed, 2 failed in the repository-wide run; one pre-existing SQLite concurrency/temporary-directory failure and the acceptance test timeout under full-suite contention. The focused acceptance test passes.`
- Typecheck: `PASS`
- Lint: `NOT RUN`
- Build: `NOT RUN`

## Files changed

- `db/schema.sqlite.sql`
- `src/server/schema-contract.ts`
- `src/application/import/staging/ImportReviewService.ts`
- `src/application/materialization/index.ts`
- `src/application/materialization/departmental.ts`
- `src/application/materialization/departmental.acceptance.test.ts`
- `artifacts/import/pulse-import-manifest.json`
- `artifacts/import/pulse-departmental-import.acceptance.report.md`

`SOURCE/RUNTIME CODE CHANGED: YES — import/materialization code only`

No source workbooks or production/runtime database were modified. The acceptance test uses an in-memory SQLite database.
