# ADR-018: Separate Goal Accountability from Execution Responsibility

- Status: Proposed
- Date: 2026-08-24
- Decision type: Domain model and migration design

## Context

PULSE currently reports `goal.owner.required` for imported Goals whose
`strategic_goals.owner_person_id` is empty. The current schema defines that
column as a nullable foreign key to `people(id)`, and
`ProgramGovernanceRules.validateGoal()` interprets `owner`,
`ownerId`, `ownerPersonId`, and `owner_person_id` as equivalent owner values.

The business meaning for the current program is different:

```text
Goal accountability       -> organizational unit
Optional personal role    -> responsible person, only if explicitly required
Activity/action execution -> person or unit assignments
```

The valid Goal-accountability units for the current business case are expected
to include HEAD OFFICE and REFINERY. These are not currently represented as
canonical seeded entities in the repository.

This ADR is an architectural decision record only. It does not change schema,
production code, governance, remediation, approval behavior, tests, or data.

## Evidence

### Strategic goals

`db/schema.sqlite.sql` defines:

```text
strategic_goals.owner_person_id -> people.id
```

`GoalRepository.create()` accepts only a Goal id and title, and
`GoalRepository.update()` updates only the title. There is no supported Goal
write path for a person owner.

The relational baseline in `db/migrations/0001_pulse.sql` uses the same
person-oriented relationship. Existing values must therefore be treated as
historical data whose meaning is not yet proven.

### Program domain

`ProgramEntity` contains a generic display field named `owner: string`.
`Goal` inherits that field. The type does not distinguish organizational
accountability from individual responsibility.

`ProgramMapper` maps Goal-like rows through `owner_person_id`, while Actions
and Work Items also use person ownership and department references. This is a
compatibility-oriented projection, not evidence that all hierarchy levels have
the same ownership semantics.

### Organizational model

The current relational organization model contains:

```text
departments(id, name, active)
seats(department_id, ...)
people(seat_id, ...)
users(department_id, ...)
```

Departments are flat operational units. Seats belong to departments and
people are connected to seats. Authorization scopes use department ids for
DEPARTMENT-scoped users.

The domain organization layer exposes Unit, Position, and Person concepts and
derives a person's Unit from their Position. It does not define a separate
accountability hierarchy or canonical HEAD OFFICE/REFINERY records.

### Execution responsibility

The program domain defines:

```text
AssignmentEntityType = PERSON | UNIT
AssignmentRole = OWNER | EXECUTOR | COLLABORATOR
AssignmentResponsibilityType = PRIMARY | SUPPORT
```

Activities and Actions use these assignments. Governance and responsibility
assessment already distinguish person assignments from unit assignments and
enforce primary responsibility for the relevant operational entities.

This is the existing model for execution responsibility and must not be
reused as a Goal-accountability field without an explicit semantic decision.

### Spreadsheet import

The XLSX header resolver maps `unit`, `department`, and organizational-unit
headers to semantic type `UNIT`. Normalization classifies that value as a
UNIT assignment identity. Mapping preserves the value and its cell
provenance, but does not persist it as `strategic_goals.owner_person_id` or
as a Goal-level accountability reference.

Consequently, the current `UNIT` semantic cannot be silently reinterpreted as
Goal accountability. Its existing meaning is assignment data.

### Governance and remediation

`ProgramGovernanceRules.validateGoal()` emits:

```text
goal.owner.required
```

when no person-like owner field is present. This enforces an implementation
assumption, not the confirmed business requirement.

`AssignGoalOwnerRemediation` requires `proposedOwnerPersonId`, resolves a
person, and overlays a person display name onto the Goal. It cannot represent
HEAD OFFICE or REFINERY accountability and is therefore not semantically
correct for future Goal governance.

ADR-017 and commit `9c83efe` correctly preserve immutable import evidence and
apply import-scoped remediation without mutating canonical data. That
mechanism remains technically sound, but its current remediation payload is
based on the person-owner assumption.

## Decision

PULSE will model Goal accountability as a distinct organizational concept.

The target semantic model is:

```text
Goal
  -> exactly one accountable organizational unit when governance requires it
  -> optional responsible person only if business policy requires it

Activity / Action
  -> PERSON or UNIT execution assignments
  -> role and responsibility type
```

The implementation must not:

- rename `owner_person_id` and pretend its meaning changed;
- replace it directly with `department_id`;
- infer that every operational department is a Goal-accountability unit;
- use Activity/Action assignments as an implicit Goal owner;
- remove the current governance blocker merely to make imports approvable.

## Canonical organizational representation

Before schema implementation, the organization model must establish whether
HEAD OFFICE and REFINERY are:

1. top-level Organizational Units with operational departments beneath them;
2. peer organizational units that also own Goals; or
3. a narrower accountability vocabulary distinct from operational
   departments.

The preferred architecture is a canonical `OrganizationalUnit` model with:

- stable id;
- display name;
- active/lifecycle state;
- unit kind or classification;
- optional parent unit;
- explicit indication of whether it may own Goals.

Existing `departments` should be related to this model only after confirming
whether they are operational children, equivalent units, or a legacy
representation. A direct foreign key from Goals to `departments` is not
approved by this ADR.

## Treatment of `owner_person_id`

Existing `strategic_goals.owner_person_id` values must not be reinterpreted
automatically.

The migration investigation must classify existing values:

- genuine historical individual Goal owners;
- placeholder/reference-roster values;
- values written by tests or compatibility paths;
- values that were intended to mean an organizational unit but happen to
  reference a person.

Until that classification is complete:

- retain the column for backward compatibility;
- treat it as legacy owner data;
- do not use it to satisfy the new accountability rule;
- do not backfill an accountable unit from a person;
- do not silently map it to `responsible_person_id`.

If the business confirms that historical person ownership represents personal
responsibility, a later migration may copy it into an explicitly named
responsible-person field with an auditable classification. Otherwise it
remains legacy evidence and requires an explicit manual mapping policy.

## XLSX semantics

The existing `UNIT` semantic remains an execution-assignment semantic until a
new contract is approved.

The preferred future import model is one of:

- a distinct header semantic such as `GOAL_ACCOUNTABLE_UNIT`, if the workbook
  explicitly identifies Goal accountability; or
- a context-aware interpretation of `UNIT` only when the source structure
  proves that the value belongs to a Goal accountability column.

The generic `UNIT` field must not be globally reclassified. Existing source
records and provenance must retain their original semantic type and meaning.

## Future governance semantics

The future Goal rule should express the business requirement, for example:

```text
goal.accountability.required
```

Its validation target is an active canonical Organizational Unit permitted to
own Goals, not a person.

The current `goal.owner.required` rule remains unchanged until the new
accountability model is implemented, migrated, and validated. Current
blockers must not be deleted or downgraded as a workaround.

## Future remediation semantics

The current `AssignGoalOwnerRemediation` contract is retained as historical
implementation for existing imports and is not the target contract for new
Goal-accountability semantics.

The future contract should be separately named, for example:

```text
AssignGoalAccountableUnitRemediation
```

It should carry:

- import scope;
- target Goal;
- proposed accountable Organizational Unit id;
- expected analysis revision;
- expected prior effective accountability;
- reason;
- actor and audit context.

Any future personal-responsibility remediation must be a separate contract
with a separate rule and explicit business meaning.

## Approval readiness

Approval behavior remains unchanged during this architectural phase.

After implementation, approval should require:

- valid Goal accountability for every governed Goal;
- valid hierarchy and source evaluation;
- required Activity/Action responsibility coverage;
- absence of all other critical governance blockers.

The existence of a valid accountable unit must not automatically satisfy
person-level execution responsibility requirements, and an execution
assignment must not automatically satisfy Goal accountability.

## Historical import compatibility

Existing import artifacts are immutable evidence and remain reproducible:

- workbook/source artifacts;
- `import_records`;
- cell and row provenance;
- `baseline_program_json`;
- `import_analysis_revisions`;
- `import_remediations`;
- append-only audit records.

The new domain model must not rewrite historical baselines or make old
revisions appear to have used a new semantic. Historical revisions should
retain the rule names, payload shapes, effective projections, and provenance
that were actually produced.

Future analysis may carry a model/rule version. If historical imports are
re-analyzed under the new contract, the result must be a new explicit
revision with the new rule semantics and an audit record explaining the
semantic version transition.

ADR-017's immutable overlay and transactional revision behavior should be
retained. Its person-owner remediation is superseded for future semantics,
not rewritten in history.

## Audit implications

Future accountability changes must record:

- old and new accountable unit ids and display names;
- target Goal;
- import id and analysis revision;
- source finding and provenance snapshot when import-scoped;
- actor;
- reason;
- semantic/rule version.

No historical audit record should be rewritten or relabeled.

## Alternatives considered

### Reuse `departments` directly

Rejected for now. Departments are flat operational units and there is no
evidence that HEAD OFFICE and REFINERY belong to the same semantic level.
Direct reuse risks conflating operational reporting, authorization scope, and
strategic accountability.

### Replace `owner_person_id` with `department_id`

Rejected. It destroys the distinction between historical person ownership,
operational department membership, and strategic accountability.

### Use Activity/Action UNIT assignments

Rejected. Execution responsibility is lower in the hierarchy and already has
role/responsibility semantics.

### Remove `goal.owner.required`

Rejected. That would weaken governance without adding the correct business
constraint.

### Add a narrow Goal-accountability table

Viable only if HEAD OFFICE/REFINERY are a fixed vocabulary that will never
participate in broader organization, authorization, reporting, or hierarchy
needs. This remains an option if the organization investigation disproves the
need for a canonical OrganizationalUnit model.

## Migration strategy

Migration must be staged and reversible:

1. Inventory current departments, seats, people, Goal owner values, import
   baselines, remediation rows, and audit rows.
2. Obtain authoritative definitions and stable identifiers for HEAD OFFICE
   and REFINERY.
3. Decide whether Organizational Units are hierarchical and how departments
   relate to them.
4. Add new structures without removing `owner_person_id`.
5. Backfill only from authoritative source data, never by inference from a
   person or department name.
6. Dual-read only behind an explicit model version.
7. Introduce new governance and remediation contracts.
8. Validate historical reproducibility and new import behavior.
9. Deprecate legacy person-owner writes after migration evidence is accepted.
10. Remove legacy fields only in a separately approved breaking migration.

Every migration step must be tested on a copy/backup and have a rollback
path that restores the previous schema and preserves append-only audit data.

## Phased implementation plan

### PHASE A — Domain model

- Affected components: `src/domain/program/types.ts`, Goal/program mappers,
  organization domain types.
- Boundary: define accountability separately from generic display owner and
  execution assignments.
- Migration risk: high if existing `owner` projections are reinterpreted.
- Compatibility risk: high for consumers expecting `Goal.owner`.
- Tests: type-level contracts, mapping fixtures, distinction tests.
- Rollback: retain legacy projections and feature-flag the new model.

### PHASE B — Organizational data model / migration

- Affected components: `db/schema.sqlite.sql`, migrations, organization
  repositories/seed data.
- Boundary: establish canonical Organizational Unit semantics and the
  relationship to departments.
- Migration risk: highest; requires authoritative HEAD OFFICE/REFINERY
  identities and backfill decisions.
- Compatibility risk: authorization and reporting may depend on departments.
- Tests: migration, foreign keys, hierarchy, rollback, seed determinism.
- Rollback: additive migration with preserved legacy columns and backup
  restore procedure.

### PHASE C — Goal persistence/API

- Affected components: GoalRepository, Goal API routes, application ports,
  ProgramMapper.
- Boundary: persist/read accountable unit and optional responsible person
  explicitly.
- Migration risk: API payload and nullability changes.
- Compatibility risk: existing clients and tests use `owner_person_id`.
- Tests: CRUD, authorization, legacy read compatibility, invalid unit
  rejection.
- Rollback: dual-read/dual-write only if auditably defined; otherwise revert
  behind a feature flag.

### PHASE D — XLSX semantic mapping

- Affected components: semantic types, header resolver, normalization,
  mapping, import contracts.
- Boundary: distinguish Goal accountability from generic UNIT assignment.
- Migration risk: historical source semantics must remain unchanged.
- Compatibility risk: existing workbooks use `UNIT` for assignments.
- Tests: explicit Goal-accountability header, generic UNIT preservation,
  merged-cell inheritance, provenance.
- Rollback: disable the new semantic version while retaining baseline data.

### PHASE E — Governance

- Affected components: `ProgramGovernanceRules`, governance contracts,
  evaluation adapters.
- Boundary: validate accountable organizational units, not persons.
- Migration risk: changes blocker counts and approval readiness.
- Compatibility risk: existing `goal.owner.required` reports.
- Tests: missing/invalid/inactive unit, valid HEAD OFFICE/REFINERY, separation
  from responsibility rules.
- Rollback: retain versioned rule evaluation; do not mutate old findings.

### PHASE F — Import baseline/evaluation compatibility

- Affected components: ImportJob, baseline/revision persistence, re-analysis
  services.
- Boundary: version analysis semantics while preserving historical snapshots.
- Migration risk: accidental baseline rewriting.
- Compatibility risk: old remediation and report payloads.
- Tests: historical reload, new revision versioning, provenance equality,
  old-rule reproducibility.
- Rollback: restore prior analysis version and preserve all revisions.

### PHASE G — Remediation

- Affected components: new accountability remediation contract, import review
  service, repositories, audit records, UI payloads.
- Boundary: apply an import-scoped accountable-unit overlay.
- Migration risk: old person-owner remediation records.
- Compatibility risk: ADR-017 API and UI contracts.
- Tests: valid unit, invalid/inactive unit, stale revision, rollback,
  unchanged evidence, audit completeness.
- Rollback: keep historical `AssignGoalOwnerRemediation` read-only and disable
  new writes.

### PHASE H — Approval readiness

- Affected components: `approvalReadiness`, governance blocker aggregation,
  API approval route.
- Boundary: require correct accountability plus execution responsibility.
- Migration risk: approval outcomes change.
- Compatibility risk: existing imports and operational expectations.
- Tests: each blocker class independently, all ten equivalent scenarios,
  final approval audit.
- Rollback: retain versioned readiness evaluation; never bypass blockers.

### PHASE I — UI

- Affected components: ImportPage, Goal views, organization management.
- Boundary: display accountability units separately from responsible people
  and execution assignments.
- Migration risk: user confusion and incorrect selection.
- Compatibility risk: current person-owner remediation UI.
- Tests: accessibility, selection validation, provenance/evidence display,
  stale-state handling.
- Rollback: hide new controls while preserving read-only historical views.

### PHASE J — Regression/runtime validation

- Affected components: full application and developer runtime.
- Boundary: verify cross-context behavior.
- Migration risk: environment/database differences.
- Compatibility risk: historical imports and existing operational data.
- Tests: focused, full suite, typecheck, lint, build, real workbook, security,
  persistence, audit, historical reload.
- Rollback: restore backup and disable the new semantic version.

## Risks

- Treating departments as strategic owners could corrupt authorization and
  reporting semantics.
- Reinterpreting `owner_person_id` could corrupt historical meaning.
- Reclassifying generic XLSX `UNIT` values could change source semantics.
- Renaming the rule without versioning could make historical reports
  irreproducible.
- Removing current blockers before the new model exists would weaken
  governance.
- Changing approval readiness before migration validation could approve
  semantically incomplete programs.

## Consequences

This decision intentionally postpones implementation. The current import
behavior and current governance blockers remain unchanged until the
Organizational Unit/accountability model is authoritative.

## Implementation decision

**STOP — architectural design accepted for further review; implementation is
not authorized by this ADR alone.**

