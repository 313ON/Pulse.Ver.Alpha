# ADR-022: Global system-owned PULSE business identifiers

## Status

Accepted and implemented on September 13, 2026.

## Decision

PULSE owns the business identity of every persisted domain entity that has a
PULSE-facing identity. Technical row IDs remain internal database keys;
`pulse_identifier` is the immutable human-facing identity; and
`external_source_id` records an identity supplied by an import or another
system. External values are never promoted to PULSE identifiers.

The single `IdentifierService` is the only allocator. It persists counters in
`pulse_identifier_allocations` and immutable identity records in
`pulse_entity_identities`. Allocation is atomic inside the SQLite transaction,
with unique indexes and the identity registry as integrity boundaries. Counters
are never decremented, so deletion or archival cannot cause reuse.

## Entity inventory and namespaces

The implemented inventory is: departments/units (`UNIT-###`), positions and
roles (`POS-###`), people/employees (`PER-###`), strategic goals (existing
`Gnn` format), departmental goals (`DG-###`), objectives/sub-goals
(`OBJ-###`), activities (`ACT-###`), actions/work items (existing
`Gnn-Onn-Ann-Tnnn` format), KPIs (`KPI-###`), risks (`RISK-###`),
dependencies (`DEP-###`), and monthly reviews (`REV-###`). The planning
program itself is a planning context rather than a persisted table in the
current domain model; the allocator exposes a `program` policy for future
materialization without inventing a row identity today.

Global entities use global allocation scopes. Program and review entities use
plan-cycle scopes. Objectives and activities use parent scopes. Actions retain
the established plan-year and hierarchy-shape scope. Existing valid goal and
action identifiers are preserved; missing identities are allocated during the
idempotent `0008_global_pulse_identity` migration.

## Enforcement

Create APIs discard client PULSE identity fields. Repositories allocate new
identities and updates do not accept identity fields. The identity registry has
append-only triggers, and all canonical tables have unique PULSE identifier
indexes. Imports and materialization preserve an existing canonical identity,
allocate one for new records, and keep source record IDs in provenance or
`external_source_id`.

Migration `0008_global_pulse_identity` extends the existing `0007` allocator,
repairs the old two-type check constraint for existing databases, adds identity
columns to canonical entities, and backfills the registry without resetting or
renumbering data.
