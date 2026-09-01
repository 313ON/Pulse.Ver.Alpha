# PULSE Import Manifest Report

## Status

`BLOCKED`

## Source authorities

- Organizational identity: `Samples/- 1404ورژن 7 خرداد.xlsx`
- Requested planning authority: `برنامه_سالانه_شرکت_1405_IT_Professional_V1_FIXED.xlsx`

The accepted FIXED planning workbook is not present in the workspace or searched project source locations. The departmental maintenance workbook was not substituted.

## Identity extraction

The 1404 workbook supports a reconstructed identity model:

- Units: 10 candidate canonical records
- Roles: 32 verification roles
- Aliases: 5 derived typographic variants

Identity records preserve source workbook, worksheet, cell provenance, and `EXPLICIT`, `DERIVED`, or `AMBIGUOUS` classification.

Review remains required for:

- unit-versus-role boundaries such as `فناوری`, `مهندسی محصول`, and `تولید`
- committee/workstream semantics
- aliases whose source spelling could represent a synonym rather than a typo

The five emitted aliases are limited to the requested normalization candidates:

- `تعمیر کار` → `تعمیرکار`
- `انبار دار` → `انباردار`
- `مسئول آزمایشکاه` → `مسئول آزمایشگاه`
- `پایپینک` → `پایپینگ` (workstream classification)
- `سرشفت تولید` → `سرشیفت تولید`

`فناوری` → `کارشناس فناوری` and `مهندس محصول` → `مهندسی محصول` were not emitted as aliases.

## Planning extraction

No planning records were fabricated.

The manifest currently contains:

- Goals: 0
- Objectives: 0
- Activities: 0
- Actions: 0

Expected accepted planning counts remain:

- Goals: 10
- Objectives: 21
- Activities: 76
- Actions: 252

G08 is represented as a required planning condition with status `UNMAPPED_AT_IT_ACTION_LEVEL`, but no Goal record was created because the accepted planning source is unavailable. No Objective, Activity, or Action was invented.

## Validation

### Passed identity checks

- All 32 required roles present.
- Unit references point to emitted Unit IDs.
- Alias targets point to emitted canonical entities.
- No duplicate canonical IDs.

### Failed planning checks

- Goal count: expected 10, actual 0.
- Objective count: expected 21, actual 0.
- Activity count: expected 76, actual 0.
- Action count: expected 252, actual 0.
- Hierarchy integrity: not satisfied.
- Action ID uniqueness and parent-ID agreement: not run.

## Responsibility mappings

Responsibility resolution was not run because the accepted FIXED planning source is missing. No values from the forbidden departmental maintenance workbook were used.

## Import readiness

`BLOCKED`

The identity portion is structurally prepared with review annotations. The complete import manifest is not ready because the authoritative planning source is absent, which breaks source integrity and prevents extraction of the required hierarchy.

## Next step

Place the accepted workbook at:

`برنامه_سالانه_شرکت_1405_IT_Professional_V1_FIXED.xlsx`

Then populate the planning arrays and rerun all planning and responsibility validation gates.
