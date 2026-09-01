# PULSE — HTTP Materialization Route Acceptance

## STATUS

`PASS WITH WARNINGS`

## ROUTE

`POST /api/imports/[id]/materializations`

## HTTP SUCCESS

`PASS` — an actual `Request` was sent to the production Next route handler.
The first authorized request returned `201` with one completed departmental
materialization operation, `500` materialized records, a valid operation ID,
provenance count, and SHA-256 source fingerprint.

## AUTHENTICATION

`PASS` — authenticated session accepted; unauthenticated request returned
`401 / UNAUTHORIZED`; inactive actor session was also rejected.

## CSRF

`PASS` — matching cookie/header token accepted; invalid token returned
`403 / FORBIDDEN`.

## RBAC

`PASS` — active super-admin actor accepted; viewer actor returned
`403 / FORBIDDEN`.

## APPROVAL

`PASS` — non-approved import was rejected through the route using the
established sanitized `500 / INTERNAL_ERROR` contract.

## SNAPSHOT

`PASS` — the route delegated to the existing immutable approved-analysis
snapshot and idempotency checks; no test-only business logic was added.

## PROVENANCE

`500 / 500 / 0 / 0` — total / valid / missing / broken.

## SOURCE FINGERPRINT

`PASS` — a 64-character SHA-256 fingerprint was returned and persisted on the
materialization operation.

## PERSISTENCE

- Departmental records before reopen: `500`
- Departmental records after reopen: `500`
- Materialization operations after reopen: `1`
- Canonical baseline after request: `10 strategic_goals / 0 sub_goals /
  0 activities / 6 work_items`

## IDEMPOTENCY

- First request: `201`, `duplicate: false`, one operation created.
- Repeated request: `200`, same operation identity, `duplicate: true`.
- Result: no duplicate departmental records and no duplicate operation.

## ROLLBACK

`PASS` — controlled SQLite insertion failure returned `500 / INTERNAL_ERROR`;
zero departmental records, zero orphan operation, and zero materialization audit
event remained.

## CANONICAL ISOLATION

Canonical IT:

`0 / 0 / 0 / 0`

## AUDIT EVENT

`PASS` — exactly one
`departmental_materialization_completed` audit event was persisted for the
successful operation.

## SECURITY NEGATIVE CASES

- Unauthenticated: `PASS` — `401 / UNAUTHORIZED`.
- Missing/invalid CSRF: `PASS` — `403 / FORBIDDEN`.
- Unauthorized actor: `PASS` — `403 / FORBIDDEN`.
- Unapproved import: `PASS` — rejection, `500 / INTERNAL_ERROR`.
- Missing/inactive actor: `PASS` — inactive session rejected with
  `401 / UNAUTHORIZED`.

## TEST RESULTS

- HTTP route acceptance: `PASS` — 1 file, 3 tests.
- Departmental focused acceptance and existing persistent/security/rollback
  tests: `PASS` — 7 files, 50 tests.
- Full suite: `PASS` — 53 files, 299 tests.
- Typecheck: `PASS`.
- Lint: `PASS`.
- Build: `PASS`.

## LEGACY DB WARNING

`WARNING REMAINS` — runtime repair of the departmental operation
`source_fingerprint` column is deterministic and idempotent in
`ensurePhaseFiveSchema`. Existing tests cover general schema/runtime repair
behavior but do not directly exercise this specific legacy fingerprint-column
repair. It affects the HTTP route through normal database initialization and
does not block this acceptance phase.

## RELEASE DECISION

`RELEASE READY WITH WARNINGS`
