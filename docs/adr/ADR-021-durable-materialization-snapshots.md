# ADR-021: Durable Approved-Plan and Historical Materialization Snapshots

## Status

Accepted as a controlled amendment to ADR-019 on September 7, 2026.

## Decision context

ADR-019 established governed import-to-canonical materialization with an
approved revision, deterministic source snapshot identity, transactional writes,
append-only provenance, and idempotent operation identity. The first foundation
persisted operation metadata, mappings, and provenance. Import/staging records
remain the reviewed source of approval, but they are not the durable authority
for canonical materialization once an approved plan snapshot exists.

Operation identity and a source hash are not historical content. The approved
plan's normalized values, responsibility resolutions, allocations, conflict
decisions, relationships, mappings, provenance references, and source references
must remain independently reconstructable after approval.

## Decision

The materialization boundary is:

`APPROVED import` → `approved materialization snapshot` → `server-derived
complete plan` → `independent integrity validation` → `canonical writer`.

The HTTP request supplies only the approved import/snapshot identity and
permitted control parameters. It does not supply canonical materialization plan
content. Caller-supplied plan content is rejected and cannot reach the writer.

On the first canonical materialization request for an approved import identity,
the application validates approval and source-snapshot identity, derives the
complete `MaterializationPlan` on the server, verifies its complete plan hash,
and initializes `approved_materialization_snapshots`. The snapshot is keyed by
`import_job_id`, `approved_analysis_revision`, and `source_snapshot_hash`.

The primary key and idempotent insert path prevent conflicting duplicate
snapshots. Concurrent first requests resolve to the existing idempotent
materialization operation; they do not create duplicate canonical writes or
partially persisted approved snapshots.

After initialization, the approved immutable snapshot is the authoritative
source for the plan. The application validates the stored payload and plan hash
before passing the plan to the canonical writer. Mutable import/staging data is
not consulted for the already-initialized plan.

The canonical writer also persists the complete validated plan as an immutable
version-2 `materialization_snapshots` row linked to the execution operation.
That execution-time snapshot is durable historical evidence for operation
reconstruction. Existing operation identity, writer transaction, provenance,
and canonical collision rules remain unchanged.

## Preserved boundaries

- Domain contracts remain free of SQLite and persistence types.
- Materialization remains an application capability after import approval.
- `REVIEW_REQUIRED` and every other unapproved import state cannot materialize.
- Canonical state remains authoritative for current canonical behavior only.
- Existing operation identity, idempotency, authorization, and provenance rules
  remain frozen.
- No caller-authored plan content is trusted for canonical output.
- Department responsibility and position/person responsibility remain distinct.
- No universal `goal.owner` abstraction is introduced.
- Canonical update/delete remain outside this capability.

## Snapshot layers and migrations

### `0004_materialization_snapshots.sql`

Adds `materialization_snapshots`, the append-only version-2 execution snapshot
for canonical materialization operations. It stores the complete validated
`MaterializationPlan`, its `plan_hash`, approved revision, source snapshot hash,
and operation identity. Existing operations without a persisted payload are
reported as `LEGACY_NON_RECONSTRUCTABLE`; missing historical values are never
fabricated. New canonical executions persist this row atomically with canonical
writes.

### `0005_departmental_materialization_snapshots.sql`

Adds `departmental_materialization_snapshots`, an append-only source snapshot
for the separate departmental/supporting materialization path. It pins the
approved source payload and provenance inputs for that path and does not replace
the canonical version-2 plan snapshot.

### `0006_approved_materialization_snapshots.sql`

Adds `approved_materialization_snapshots`, the append-only approved-plan
boundary. It stores the server-derived complete plan and `plan_hash` for each
approved import identity. This table is initialized lazily at first canonical
materialization, only after approval and source-snapshot validation. Its primary
key prevents conflicting duplicate snapshots, and the idempotent initialization
path safely handles repeated and concurrent first requests. Update/delete
triggers, foreign keys, and plan-hash validation protect the snapshot content.

All three snapshot tables are represented in the canonical schema and runtime
migration path. Snapshot tables use append-only protections and foreign-key
enforcement remains enabled.

## Data boundaries

- **Import/staging data:** uploaded and reviewed records, analysis revisions,
  approval state, and server-owned source classification. It is the input to
  review and approval; `REVIEW_REQUIRED` cannot materialize.
- **Approved immutable snapshot:** the server-derived complete plan selected by
  approved import identity. It is authoritative for canonical materialization
  after initialization and contains the fields determining canonical output,
  including responsibility semantics.
- **Canonical materialized data:** current strategic and operational records
  written transactionally by the canonical writer only from the validated plan.
- **Execution-time durable evidence:** operation state, mappings, append-only
  provenance, audit events, and the version-2 `materialization_snapshots` row.

## Evidence and compatibility

Mutation tests cover source-record deletion, canonical mutation, persisted
responsibility/allocation values, deterministic identity, snapshot tampering,
caller-plan tampering, concurrent idempotency, rollback, and legacy behavior.

Pre-amendment operations without a persisted payload remain explicitly
`LEGACY_NON_RECONSTRUCTABLE`; missing historical values are never fabricated.

The first materialization release creates only absent canonical identities.
Equivalent reuse requires an explicit policy and provenance record. Conflicting
existing entities are rejected. Canonical updates and deletes are outside this
capability.

## Explicit non-goals

This ADR does not:

- approve or reject an import;
- materialize any real import as part of the ADR itself;
- define a canonical public-ID allocation algorithm;
- add canonical provenance persistence beyond the existing capability;
- implement API routes or UI features;
- implement canonical update/delete;
- implement automatic cross-import reuse;
- infer new KPI semantics;
- change existing import approval behavior.
