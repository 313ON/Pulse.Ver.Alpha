# ADR-022: System-owned PULSE business identifiers

## Status

Accepted.

## Decision

PULSE owns and allocates the human-visible business identifiers used by strategic goals and actions. Database primary keys and other row IDs remain technical identifiers. The existing business formats are preserved: goals use `Gnn`; actions use `Gnn-Onn-Ann-Tnnn`.

Allocation is centralized in `IdentifierService` and persisted in SQLite `pulse_identifier_allocations`. Allocation keys are global for goals and scoped by plan year plus action shape for actions. SQLite atomic updates provide concurrency safety; the database unique constraint remains the final integrity boundary. Allocated values are never decremented or reused after deletion.

Existing valid identifiers are preserved. New UI/API creates omit client identifiers; API boundaries discard supplied goal/action identifiers. Materialization allocates identifiers through the same service and stores source identifiers separately in `work_items.external_source_id`. Reused canonical entities retain their existing PULSE identifier.

The allocator is an application-owned migration and does not mutate the canonical external database. Technical IDs for objectives, activities, departments, people, and related rows remain separate because they are not established PULSE business identifiers.
