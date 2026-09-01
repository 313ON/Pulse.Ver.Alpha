# PULSE — Release Candidate Final Gate

## RELEASE CANDIDATE

- HEAD: `ff5a04e07386c5c52c03af5b6b73a5a09c2b4221`
- Branch/state: detached HEAD
- Working tree: dirty
- Staged files: none
- Tracked diff summary: 13 files, 293 insertions, 9 deletions
- No commit or push was performed.

The dirty worktree includes the accumulated departmental/import implementation,
acceptance artifacts, source fixtures, and prior runtime-validation artifacts.
It was not cleaned, reset, or otherwise mutated during this gate.

## SCOPE

Included release functionality:

- governed Excel parse, staging, review, and approval;
- immutable approved import snapshots;
- departmental/supporting materialization;
- persistent file-backed SQLite storage;
- authenticated HTTP materialization route;
- CSRF and RBAC enforcement;
- provenance and source-fingerprint validation;
- idempotency and duplicate-source protection;
- transactional rollback and audit events;
- deterministic legacy `source_fingerprint` repair;
- canonical IT isolation.

The authoritative IT planning workbook is unavailable; no canonical IT
planning records are included.

## ARCHITECTURE

Verified execution path:

`Workbook → Parse → Stage → Review → Approve → Immutable Snapshot →
HTTP/Auth/CSRF/RBAC → Materialization → Transactional Persistence → Audit`

Approval and snapshot checks remain in application services. The HTTP route
only authenticates, authorizes, validates CSRF, dispatches, and returns the
existing contract.

## DATABASE

`db/schema.sqlite.sql`, `src/server/schema-contract.ts`, and
`src/server/db.ts` are consistent for fresh and repaired databases.

- Departmental tables and foreign keys: PASS.
- Fingerprint column on fresh schema: `TEXT NOT NULL`.
- Legacy repair: transactional `TEXT NOT NULL` addition, backfill from
  `source_snapshot_hash`, and named unique index creation.
- Actual repaired catalog: PASS; schema contract reports no errors.
- Same fingerprint uniqueness: PASS.
- Different fingerprint acceptance: PASS.
- NULL fingerprint rejection: PASS.
- Second initialization: PASS; no duplicate schema objects or data mutation.

The contract expresses fingerprint uniqueness through the required named unique
index, which is the runtime enforcement mechanism.

## IMPORT

PASS — parsing, staging, review, approval, classification, provenance capture,
and server-side approval enforcement are covered by the focused matrix.

## MATERIALIZATION

PASS — departmental/supporting materialization persists validated records,
preserves provenance, records source fingerprints, rejects duplicate sources,
supports same-snapshot idempotency, and rolls back atomically.

Production-integrated acceptance preserved `3,053` records across database
reopen with `4` operations. The HTTP acceptance persisted `500` records with
one operation and no duplicate on repeat.

Canonical IT remained:

`0 / 0 / 0 / 0`

## HTTP

PASS — `POST /api/imports/[id]/materializations` was exercised through the
actual route handler with `Request` objects.

- Authenticated success: `201`.
- Repeated request: `200`, duplicate result.
- CSRF rejection: `403`.
- RBAC rejection: `403`.
- Inactive actor: `401`.
- Unauthenticated: `401`.
- Unapproved import: established sanitized rejection contract.
- Controlled failure: `500`, zero partial writes.

## SECURITY

| Control | Classification | Evidence |
|---|---|---|
| Authentication | PASS | Session lookup requires active user and unexpired session. |
| CSRF | PASS | Cookie/header equality checked with constant-time comparison. |
| RBAC | PASS | Both request and execute permissions are required. |
| Approval enforcement | PASS | Materializer accepts only `APPROVED` jobs. |
| Parameterized SQL | PASS | Changed persistence paths use prepared statements. |
| Transaction boundaries | PASS | Departmental writes and legacy fingerprint repair are transactional. |
| Provenance integrity | PASS | Complete provenance is required before departmental insertion. |
| Fingerprint integrity | PASS | Fingerprint is computed server-side and uniquely indexed. |
| Path/file handling | PASS | Tests use isolated temp DBs; workbooks are read-only fixtures. |
| Cross-domain isolation | PASS | Departmental writes target departmental tables only. |
| Auditability | PASS | Successful materialization writes an audit event. |

## DATA SAFETY

- `db/pulse.sqlite`: not modified or targeted by acceptance tests.
- Source workbooks: read-only access; no workbook modifications.
- Canonical IT records: none fabricated or imported.
- Identity manifest remains: `10` units, `32` roles, `5` aliases.
- Departmental records remain separate from canonical planning tables.
- Existing legacy rows were preserved during fingerprint repair.

## TEST MATRIX

- Focused import/materialization/persistence/security matrix: `PASS` —
  15 files, 101 tests.
- HTTP materialization tests: `PASS` — 1 file, 3 tests.
- Persistent acceptance: `PASS` — production acceptance 3 tests;
  materialization repository 9 tests; database contract 13 tests.
- Legacy repair acceptance: `PASS` — 1 file, 2 tests.
- Security: `PASS` — auth 9 tests plus HTTP negative cases.
- Rollback: `PASS` — departmental service, HTTP route, and writer rollback
  coverage.
- Idempotency/source fingerprint: `PASS` — same-snapshot repeat and
  duplicate-source protections.
- Full suite: `PASS` — 54 files, 301 tests.
- Typecheck: `PASS`.
- Lint: `PASS`.
- Build: `PASS`.

The previously classified Windows temporary-directory/multi-process
concurrency harness issue was not reopened.

## FINDINGS

| Finding | Classification | Evidence |
|---|---|---|
| Detached HEAD and dirty worktree require explicit file selection before commit | WARNING | HEAD is detached; no staged files; accumulated tracked/untracked prior-phase files remain. |
| Authoritative IT canonical workbook unavailable | DEFERRED | Separate canonical-authority input; departmental/supporting release path remains isolated and validated. |
| Dedicated multi-process legacy-repair race test absent | DEFERRED | Explicitly deferred future concurrency work; no current fingerprint-specific failure demonstrated. |

No `BLOCKER` findings were identified.

## RELEASE DECISION

`RELEASE READY WITH WARNINGS`

## DEFERRED ITEMS

- Missing IT canonical authority workbook — `DEFERRED — CANONICAL AUTHORITY
  INPUT`.
- Multi-process legacy-repair race test — `DEFERRED — FUTURE CONCURRENCY WORK`.

Neither deferred item blocks the currently implemented
departmental/supporting functionality.

