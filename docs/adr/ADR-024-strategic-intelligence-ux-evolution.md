# ADR-024: Strategic Intelligence and UX Evolution

## Decision

PULSE keeps the existing `strategic_goals`, `work_items`, and `kpis` model and adds nullable goal-brief columns to `strategic_goals`. The brief is a structured, auditable projection of organizational information, not generated content. Empty values remain explicitly incomplete.

The reusable Jalali calendar is presentation-only: it selects Jalali dates and marks dates from existing operational records. Planning events are passed into it; the component does not own event persistence or create dates.

Deadline states are deterministic: missing, invalid, overdue, due-soon (within 14 Jalali days), scheduled, completed, or cancelled. Existing action status and date contracts remain unchanged.

## Compatibility

Migration `0009_goal_brief.sql` is additive. Runtime initialization also repairs legacy SQLite databases by adding absent nullable columns. Existing identifiers, relationships, imports, and API date serialization are preserved.

## Authorization and auditability

Goal brief edits use the existing `goals.edit` permission and goal PATCH endpoint, which already records before/after audit events. No new authorization role is introduced.

## Limitations

The current schema does not provide historical KPI measurements or a reliable risk-to-goal scoring model. The implementation therefore exposes existing target/actual values and transparent deadline/progress signals without inventing trend or risk data.
