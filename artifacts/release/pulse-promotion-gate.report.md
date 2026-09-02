# PULSE — Release Commit Promotion Gate

## RELEASE COMMIT

- Branch: `release/pulse-departmental-materialization`
- HEAD: `fa4e89bffb41bd881881458dd27e4697d5245ad6`
- Base: `ff5a04e07386c5c52c03af5b6b73a5a09c2b4221`
- Parent relationship: PASS — the release commit is exactly one commit ahead
  of the intended base.
- Commit message: `feat(import): productionize departmental materialization`
- Author: `313on <bakhtarni@gmail.com>`
- Commit date: `2026-09-01 08:27:29 +0330`
- Exact scope: 52 committed files, classified as release-scope:
  9 artifacts, 2 database files, 5 documentation files, and 36 source files.
  The source files cover departmental/supporting materialization, schema/runtime
  repair, authorization, HTTP routes, UI integration, tests, and legacy
  fingerprint acceptance.

## WORKTREE

Release commit content is separated from known pre-existing unrelated content.

Unrelated dirty or untracked content remains untouched:

- `README.md`
- `docs/operations/RUNBOOK.md`
- `package.json`
- `developerAdminRecovery` files
- `scripts/` developer-recovery and loader files
- `.runtime-remediation/`
- `.runtime-validation/`
- `Samples/`
- `phase25*.ps1`
- `phase25c-result.txt`
- `runtime-validation.mjs`

No files were staged, reverted, cleaned, deleted, or amended during this gate.

## CHANGESET REVIEW

All 52 files in `ff5a04b..fa4e89b` are release-scope. No mixed or unrelated
production-code change was identified. No debug code, test-only production
branch, unsafe authorization bypass, or accidental canonical-table write was
found in the reviewed materialization paths.

## ARCHITECTURE

Verified architecture:

`Workbook → Parse → Stage → Review → Approve → Immutable Snapshot → HTTP →
Authentication → CSRF → RBAC → Validation → Transactional Materialization →
Persistence → Audit`

Verified invariants:

- Departmental/supporting records are stored separately from canonical planning
  tables; canonical IT remains `0 / 0 / 0 / 0`.
- Materialization requires an approved import.
- Materialization pins the approved analysis revision and source snapshot.
- Materialized records retain source workbook, sheet, row, cell, and provenance.
- Server-side source fingerprints and uniqueness prevent duplicate sources.
- Repeated materialization of the same approved snapshot is idempotent.
- Departmental persistence and audit insertion are transactional.

## SECURITY

| Control | Result | Evidence |
|---|---|---|
| Authentication | PASS | Active session/actor validation is required. |
| CSRF | PASS | HTTP mutation routes require CSRF validation. |
| RBAC | PASS | Request, execute, retry, and view permissions are explicit. |
| Approval | PASS | Materializers reject non-`APPROVED` imports. |
| SQL safety | PASS | Changed persistence paths use parameterized statements. |
| Actor validation | PASS | Actor must be an active user with an active authorized role. |
| Rollback | PASS | Departmental records, operation, and audit write atomically. |
| Provenance | PASS | Complete source provenance is required and persisted. |
| Fingerprint | PASS | SHA-256 fingerprint is computed server-side and uniquely indexed. |
| Audit | PASS | Successful materialization writes an audit event. |
| Isolation | PASS | Departmental materialization does not write canonical IT tables. |
| Path/file handling | PASS | Acceptance evidence uses isolated databases and read-only fixtures. |

## DATABASE

- Fresh schema: PASS — departmental tables, constraints, foreign keys, and
  fingerprint uniqueness are defined.
- Schema contract: PASS — required tables, columns, foreign keys, and index are
  represented.
- Legacy repair: PASS — missing `source_fingerprint` is added transactionally,
  backfilled deterministically from `source_snapshot_hash`, and indexed
  uniquely.
- Idempotent repair: PASS — repeated initialization preserves one column,
  one index, and existing data.
- Failure safety: PASS — duplicate backfill fails without leaving a partial
  fingerprint column or index.
- SQLite operational boundary: PASS — WAL, full synchronous mode, foreign keys,
  busy timeout, and production external-DB path rules remain enforced.
- Known multi-process race harness: DEFERRED and not reopened.

## TEST EVIDENCE

The release commit contains the exact source state reviewed by the completed
Release Candidate Gate. No production source changed between validation and
the release commit. Results below are inherited evidence; no tests were
rerun during this promotion gate.

- Departmental materialization: PASS — acceptance and persistent acceptance.
- HTTP materialization: PASS — 1 file, 3 tests.
- Security/RBAC/CSRF: PASS — focused negative and authorization cases.
- Rollback: PASS — service, HTTP, and persistence-failure coverage.
- Idempotency: PASS — same snapshot and duplicate-source protection.
- Fingerprint: PASS — SHA-256 generation and uniqueness coverage.
- Legacy repair: PASS — 1 file, 2 tests.
- Full suite: PASS — 54 files, 301 tests.
- Typecheck: PASS.
- Lint: PASS.
- Build: PASS.

## ARTIFACT CONSISTENCY

Acceptance reports, ADRs, release evidence, and the release-candidate report
were reviewed for scope, counts, canonical isolation, and deferred warnings.
The reports consistently describe the departmental/supporting boundary and the
missing canonical IT authority.

One concrete artifact defect was found:

- `artifacts/import/pulse-import-manifest.json` is not valid JSON. Parsing
  fails with additional text at line 66, caused by an extra closing object
  delimiter after `sourceAuthorities.departmentalMaterialization`.

This report-only phase does not modify or amend the immutable release commit.

## DATA SAFETY

- Production `db/pulse.sqlite`: untouched and not committed.
- Source workbooks: untouched and not committed.
- Runtime-validation copies: untouched and not committed.
- Canonical IT records: none fabricated; evidence remains `0 / 0 / 0 / 0`.
- Secrets, `.env` files, credentials, tokens, local databases, and temporary
  runtime artifacts: none committed.

## FINDINGS

| Finding | Classification | Evidence |
|---|---|---|
| Committed import manifest is syntactically invalid JSON and cannot be parsed by standard JSON tooling. | BLOCKER | `ConvertFrom-Json` failed with `Additional text encountered after finished reading JSON content` at line 66. |
| Missing authoritative IT annual-program workbook. | DEFERRED | Release Candidate Gate and manifest evidence; departmental path remains isolated. |
| Dedicated multi-process legacy-repair race test absent. | DEFERRED | Explicitly deferred; existing Windows temporary-directory issue was not reopened. |
| Known unrelated dirty/untracked worktree content remains. | WARNING | Current `git status`; no unrelated content is part of the release commit. |

## DEFERRED

- Missing authoritative IT annual-program workbook.
- Dedicated multi-process legacy-repair race test.

## PROMOTION DECISION

`PROMOTION BLOCKED`

The exact commit `fa4e89bffb41bd881881458dd27e4697d5245ad6` is not safe to
promote until the committed import manifest is corrected in a separate
controlled corrective commit and the promotion gate is rerun. The release
commit itself remains immutable in this phase.
