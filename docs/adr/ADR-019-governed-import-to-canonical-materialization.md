# ADR-019: Governed Import-to-Canonical Materialization

## Status

Accepted for R10 design and foundation implementation.

## Context

PULSE has a governed spreadsheet import pipeline:

`Workbook → parsing → semantic mapping → normalization → import staging → review → approval/rejection`

The staged import model is intentionally separate from the canonical program
tables (`strategic_goals`, `sub_goals`, `activities`, and `work_items`).
Approval currently records a review decision only; it does not mutate canonical
program data.

The application needs a safe, explicit way to turn an approved import snapshot
into canonical program data without weakening the review boundary, losing
source evidence, duplicating records on retry, or silently overwriting
canonical state.

## Decision

R10 will introduce governed import-to-canonical materialization as a separate
operation.

Materialization:

- accepts an explicit import job ID;
- requires an `APPROVED` import;
- pins the approved analysis revision;
- pins a deterministic source snapshot hash;
- requires an authorized actor and target plan year;
- rejects stale revisions, changed source records, unresolved review blockers,
  identity conflicts, and unsafe canonical collisions;
- performs canonical writes, provenance writes, operation state, and terminal
  audit in one SQLite transaction;
- is synchronous in the first release;
- is idempotent for the same import, approved revision, and source snapshot;
- never performs blind upsert or automatic canonical update/delete.

Logical identity is semantic and deterministic. Canonical public IDs are a
separate concern and will not be derived from unstable source-row ordering.
Public-ID allocation remains an explicit implementation decision until the
existing domain constraints can prove a safe algorithm.

Provenance is append-only and supports both directions:

- canonical entity → source records;
- source record → canonical entities.

Provenance relations include `CREATED_FROM`, `CONTRIBUTED_TO`, and
`REUSED_FROM`.

## Alternatives considered

### Approval automatically materializes

Rejected. It would make approval canonical-mutating and violate the existing
review/staging boundary.

### Materialize the latest approved import

Rejected. Multiple imports can coexist and filename/date ordering is not an
authoritative source-selection rule.

### Materialize by filename

Rejected. Filenames are user-controlled and are not a stable production
identity.

### Blind upsert into canonical tables

Rejected. It can silently overwrite governed canonical state and cannot explain
conflicting imports safely.

### One canonical row per import record

Rejected. Repeated workbook rows represent one logical entity with multiple
source contributions.

### Asynchronous first implementation

Deferred. Current SQLite transaction boundaries and expected import sizes support
a synchronous operation. The operation model can be extended later if volume
requires a worker.

## Consequences

R10 requires:

- typed application/domain materialization contracts;
- deterministic normalization and logical identity helpers;
- snapshot and revision verification;
- conflict classification before writes;
- append-only provenance and source-to-canonical mappings;
- materialization operation state and audit events;
- separate authorization for review, approval, and materialization;
- isolated tests for identity, conflicts, snapshots, rollback, idempotency,
  provenance, and authorization.

The first materialization release creates only absent canonical identities.
Equivalent reuse requires an explicit policy and provenance record. Conflicting
existing entities are rejected. Canonical updates and deletes are outside this
capability.

## R9 boundary

R9 remains accepted and unchanged. R10 is a new capability layered after R9
review and approval. Existing R9 runtime data, import status, approval
semantics, routes, and release artifacts are not changed by this ADR.

## Explicit non-goals

This ADR does not:

- approve or reject an import;
- materialize any real import;
- define a canonical public-ID allocation algorithm;
- add canonical provenance persistence yet;
- implement API routes or UI;
- implement canonical update/delete;
- implement automatic cross-import reuse;
- infer new KPI semantics;
- change existing import approval behavior.
