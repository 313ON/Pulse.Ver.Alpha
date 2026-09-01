# ADR-020: Departmental and Supporting Import Materialization Boundary

## Problem

The accepted IT planning authority is unavailable, while valid departmental
workbooks are available and must be staged, approved, materialized, and
audited without being promoted into canonical IT planning.

## Decision

Approved imports explicitly classified as `DERIVED`, `SUPPORTING`, `REFERENCE`,
`AMBIGUOUS`, or `UNRESOLVED` are materialized into:

- `departmental_materialization_operations`
- `departmental_planning_records`

The existing import lifecycle, immutable snapshot, approval gate, and
transactional semantics are reused. Departmental records retain raw and
normalized payloads, classification, domain, source identity, and complete
cell provenance. Materialization is idempotent on
`import_job_id + approved_analysis_revision + source_snapshot_hash`.

Canonical tables remain reserved for accepted canonical authority.

## Alternatives considered

1. Write departmental records into canonical planning tables — rejected because
   this would contaminate canonical IT semantics.
2. Keep departmental records only in `import_records` — rejected because
   staged records are not a durable materialized operational data set.
3. Create a second independent import lifecycle — rejected because it would
   duplicate approval, snapshot, and audit behavior already provided by PULSE.

## Consequences

- Departmental work can operate while canonical IT planning remains blocked.
- Canonical Goal/Objective/Activity/Action counts remain zero when IT authority
  is absent.
- Supporting and derived records are queryable and auditable separately.
- A future canonical authority can be imported without reinterpreting existing
  departmental records.
- A later read/reporting surface may be added for departmental records; this
  ADR does not authorize runtime UI changes.
