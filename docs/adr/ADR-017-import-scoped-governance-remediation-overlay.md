# ADR-017: Import-Scoped Governance Remediation Overlay

- Status: Accepted
- Date: 2026-08-24

## Problem

The governed XLSX review pipeline can detect critical `goal.owner.required`
findings and block approval, but the reviewer has no safe way to correct a
missing owner for the imported review. The original workbook evidence and
canonical strategic-goal state must remain unchanged.

## Alternatives

1. Mutate workbook evidence: rejected because it destroys source truth and
   invalidates cell provenance.
2. Mutate canonical strategic-goal state: rejected because an import review
   must not silently change the live program for every consumer.
3. Create a corrected import revision: valid but unnecessarily heavy for the
   first single-rule slice.
4. Generic governance remediation engine: rejected because different rules
   have different targets, values, and validation semantics.

## Decision

Use a narrow, import-scoped immutable remediation overlay for
`goal.owner.required`.

The effective review projection is:

```text
staged import baseline + owner overlay
→ deterministic re-analysis
→ governance
→ approvalReadiness
```

The overlay changes only the effective `Program` used for that import's
re-analysis. `ImportRecord` values, workbook files, cell provenance, and
canonical SQLite program tables are not mutated.

## Persistence and History

`import_remediations` stores the actor, import scope, target goal, rule,
old/new effective owner, reason, finding/provenance snapshots, expected
analysis revision, and resulting revision.

`import_analysis_revisions` stores each completed validation/evaluation/
governance snapshot. `import_jobs` retains the latest snapshot and revision
for backwards-compatible reads. The first completed analysis also persists
the exact analyzed program projection in `import_jobs.baseline_program_json`;
this field is write-once and is the authoritative baseline for all later
import-scoped re-analysis.

## Authorization

The remediation API requires the existing `imports.manage` permission and
CSRF protection. The selected owner must be an existing active person.

## Concurrency

Remediation and approval accept the expected current analysis revision.
The application rejects stale revisions with a controlled conflict response
instead of overwriting newer review state.

## Audit

The structured remediation and analysis tables preserve detailed history.
The existing append-only `audit_log` records the actor, import, finding,
old/new owner, reason, expected revision, resulting revision, and resulting
governance state.

## Rollback

History is retained. A future correction or reversal must be represented by
another compensating remediation and a new analysis revision; prior records
are not deleted.

## Approval Safety

Remediation never sets approval readiness. Existing `approvalReadiness`
remains authoritative and is recomputed from the newest persisted analysis.
Other critical governance, hierarchy, validation, and responsibility
findings continue to block approval.

## Generalization Criteria

Do not generalize this contract until a second remediation rule is required
and demonstrates materially different target/value/authorization semantics.
