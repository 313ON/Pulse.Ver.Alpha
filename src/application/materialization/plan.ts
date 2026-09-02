import { createHash } from "node:crypto";
import type { ImportJob } from "../import/staging/ImportJob";
import type { ImportRecord } from "../import/contracts";
import { normalizeJalaliDate } from "../import/normalization";
import {
  createImportSnapshotReference,
  verifyMaterializationRequest,
  type ImportSnapshotReference,
  type MaterializationConflict,
  type MaterializableEntityType,
  type MaterializationRequest
} from "./index";
import { groupByLogicalIdentity, logicalEntityIdentity, normalizeLogicalText } from "./identity";

export type LogicalEntityReference = {
  entityType: MaterializableEntityType;
  logicalKey: string;
  title: string;
  planYear: number;
};

export type CanonicalEntityReference = {
  entityType: MaterializableEntityType;
  canonicalId: string;
  logicalKey: string;
  values: Record<string, unknown>;
  importJobId?: string;
};

export type ParentReference = LogicalEntityReference & { relation: "PARENT" };

export type SourceRecordReference = {
  recordId: string;
  entityType: ImportRecord["entityType"];
  rowNumber?: number;
  source: ImportRecord["source"];
  provenance: NonNullable<ImportRecord["provenance"]>;
};

export type RequiredValueResolution = {
  field: string;
  rawValue?: unknown;
  normalizedValue?: unknown;
  resolved: boolean;
  targetType?: "PERSON" | "UNIT";
  targetId?: string;
  displayName?: string;
  reason?: string;
};

export type MaterializationPlanItem = {
  entityType: MaterializableEntityType;
  logicalIdentity: LogicalEntityReference;
  parent?: ParentReference;
  sourceRecords: SourceRecordReference[];
  normalizedValues: Record<string, unknown>;
  responsibility: RequiredValueResolution[];
  ordering: { parentOrdinal?: number; ordinal: number; sourceSheetIndex: number; sourceRow: number; sourceRecordId: string };
  canonicalAllocation: { ordinal: number; publicIdInput?: string };
  conflictState: "NONE" | "REUSE" | "BLOCKED";
  canonicalReference?: CanonicalEntityReference;
  provenanceReferences: Array<{ relation: "CREATED_FROM" | "CONTRIBUTED_TO" | "REUSED_FROM"; sourceRecordId: string }>;
};

export type MaterializationPlanSummary = {
  goals: number;
  objectives: number;
  activities: number;
  workItems: number;
  sourceRecords: number;
  blockedItems: number;
};

export type MaterializationPlanError = MaterializationConflict & {
  severity: "BLOCKING";
  field?: string;
  sourceValue?: unknown;
  targetType?: string;
};

export type MaterializationPlanWarning = {
  code: string;
  message: string;
  entityType?: MaterializableEntityType;
  identityKey?: string;
  recordIds?: string[];
};

export type MaterializationPlan = {
  status: "READY" | "BLOCKED";
  importJobId: string;
  approvedAnalysisRevision: number;
  sourceSnapshot: ImportSnapshotReference;
  planYear: number;
  items: MaterializationPlanItem[];
  summary: MaterializationPlanSummary;
  errors: MaterializationPlanError[];
  warnings: MaterializationPlanWarning[];
  planHash: string;
};

export type CanonicalConflictReader = {
  findByLogicalIdentity(input: LogicalEntityReference): CanonicalEntityReference | undefined;
};

export type ResponsibilityResolver = {
  resolvePerson(value: unknown, record: ImportRecord): RequiredValueResolution;
  resolveUnit(value: unknown, record: ImportRecord): RequiredValueResolution;
};

export type MaterializationPlanInput = {
  importJob: ImportJob;
  snapshot: ImportSnapshotReference;
  request: Pick<MaterializationRequest, "importJobId" | "approvedAnalysisRevision" | "sourceSnapshotHash" | "targetPlanYear">;
  planYear: number;
  canonical?: CanonicalConflictReader;
  responsibility?: ResponsibilityResolver;
  allowReuseFromSameImport?: boolean;
};

const entityOrder: MaterializableEntityType[] = ["goal", "departmental_goal", "objective", "activity", "action"];
const workTypes = new Set(["پروژه", "اقدام", "فعالیت تکرارشونده", "پایش KPI", "Milestone"]);
const parentType: Record<MaterializableEntityType, MaterializableEntityType | undefined> = {
  goal: undefined, departmental_goal: "goal", objective: "departmental_goal", activity: "objective", action: "activity"
};

function resolvedParentKey(record: ImportRecord, entityType: MaterializableEntityType, planYear: number): string | undefined {
  if (entityType === "goal") return undefined;
  if (entityType === "departmental_goal") {
    if (!normalizeLogicalText(record.data.strategicGoal)) return undefined;
    return logicalEntityIdentity({ ...record, entityType: "goal", data: { goal: record.data.strategicGoal ?? record.data.goal } }, planYear).key;
  }
  const parent = entityType === "objective" && !normalizeLogicalText(record.data.departmentalGoal)
    ? "goal"
    : parentType[entityType]!;
  if (entityType === "objective" && normalizeLogicalText(record.data.departmentalGoal)) {
    return logicalEntityIdentity({ ...record, entityType: "departmental_goal", data: { ...record.data, departmentalGoal: record.data.departmentalGoal } }, planYear).key;
  }
  return logicalEntityIdentity({
    ...record,
    entityType: parent,
    data: {
      goal: record.data.goal,
      strategicGoal: record.data.strategicGoal,
      departmentalGoal: record.data.departmentalGoal,
      objective: record.data.objective,
      activity: record.data.activity
    }
  }, planYear).key;
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).sort().join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
}

function sourceRef(record: ImportRecord): SourceRecordReference {
  return { recordId: record.id, entityType: record.entityType, rowNumber: record.rowNumber, source: record.source, provenance: [...(record.provenance ?? [])] };
}

function date(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const result = normalizeJalaliDate(value);
  return result.valid ? result.value : undefined;
}

function error(code: MaterializationConflict["code"], message: string, item?: MaterializationPlanItem, extra: Partial<MaterializationPlanError> = {}): MaterializationPlanError {
  return { code, message, severity: "BLOCKING", entityType: item?.entityType, identityKey: item?.logicalIdentity.logicalKey, recordIds: item?.sourceRecords.map((record) => record.recordId), ...extra };
}

export function serializeMaterializationPlan(plan: Omit<MaterializationPlan, "planHash">): string {
  return stable({ ...plan, items: [...plan.items].sort((a, b) => a.logicalIdentity.logicalKey.localeCompare(b.logicalIdentity.logicalKey)) });
}

export function materializationPlanHash(plan: Omit<MaterializationPlan, "planHash">): string {
  return createHash("sha256").update(serializeMaterializationPlan(plan)).digest("hex");
}

export function buildMaterializationPlan(input: MaterializationPlanInput): MaterializationPlan {
  const { importJob: job, snapshot, request } = input;
  const errors: MaterializationPlanError[] = [];
  const warnings: MaterializationPlanWarning[] = [];
  if (job.status !== "APPROVED") errors.push(error("NOT_APPROVED", "The import must be APPROVED before planning."));
  if (!job.approvedAt) errors.push(error("NOT_APPROVED", "An approved import must have approvedAt."));
  if (job.analysisRevision !== input.request.approvedAnalysisRevision) errors.push(error("REVISION_MISMATCH", "The approved analysis revision is stale."));
  if (snapshot.sourceRecordCount !== job.records.length) errors.push(error("SNAPSHOT_MISMATCH", "Snapshot record count does not match the pinned import."));
  if (snapshot.targetPlanYear !== input.planYear || request.targetPlanYear !== input.planYear) errors.push(error("INVALID_SOURCE", "Plan year is not consistently pinned."));
  if (job.validationResult && !job.validationResult.valid) errors.push(error("INVALID_SOURCE", "The import validation state is not valid."));
  const governanceErrors = job.assessmentResult?.governance.errors
    .filter((violation) => violation.rule !== "goal.owner.required") ?? [];
  if (governanceErrors.length) errors.push(error("INVALID_SOURCE", "Import governance contains blocking errors."));
  if (job.assessmentResult?.findings.some((finding) => finding.severity === "error")) errors.push(error("INVALID_SOURCE", "Import responsibility assessment contains blocking errors."));
  try {
    const expected = createImportSnapshotReference(job, input.planYear);
    errors.push(...verifyMaterializationRequest(job, request, expected).map((item) => ({ ...item, severity: "BLOCKING" as const })));
    if (expected.sourceSnapshotHash !== snapshot.sourceSnapshotHash) errors.push(error("SNAPSHOT_MISMATCH", "Pinned source snapshot hash does not match the import."));
  } catch (cause) {
    errors.push(error("INVALID_SOURCE", cause instanceof Error ? cause.message : "Unable to verify import snapshot."));
  }

  const records = job.records.filter((record): record is ImportRecord & { entityType: MaterializableEntityType } => entityOrder.includes(record.entityType as MaterializableEntityType));
  const groups = groupByLogicalIdentity(records, input.planYear);
  const parentKeys = new Set([...groups.keys()].filter((key) => key.startsWith("goal|") || key.startsWith("departmental_goal|")));
  const items: MaterializationPlanItem[] = [];
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [, sourceRecords] of sortedGroups) {
    const first = sourceRecords[0];
    const identity = logicalEntityIdentity(first, input.planYear);
    const item: MaterializationPlanItem = {
      entityType: identity.entityType,
      logicalIdentity: { entityType: identity.entityType, logicalKey: identity.key, title: identity.title, planYear: identity.planYear },
      sourceRecords: [...sourceRecords].sort((a, b) => (a.source.metadata.sheetIndex as number ?? 0) - (b.source.metadata.sheetIndex as number ?? 0) || (a.rowNumber ?? 0) - (b.rowNumber ?? 0) || a.id.localeCompare(b.id)).map(sourceRef),
      normalizedValues: {},
      responsibility: [],
      ordering: { ordinal: 0, sourceSheetIndex: Number(first.source.metadata.sheetIndex ?? 0), sourceRow: first.rowNumber ?? 0, sourceRecordId: first.id },
      canonicalAllocation: { ordinal: 0 },
      conflictState: "NONE",
      provenanceReferences: sourceRecords.map((record, index) => ({ relation: index === 0 ? "CREATED_FROM" : "CONTRIBUTED_TO", sourceRecordId: record.id }))
    };
    const fields = new Set(sourceRecords.flatMap((record) => Object.keys(record.data)));
    for (const field of [...fields].sort()) {
      const values = [...new Set(sourceRecords.map((record) => normalizeLogicalText(record.data[field])).filter(Boolean))];
      if (values.length > 1 && ["goal", "objective", "activity", "action", "title", "description", "deliverable", "owner", "executor", "department", "unit", "startDate", "endDate", "workType", "status"].includes(field)) {
        errors.push(error("IDENTITY_COLLISION", `Contributing records disagree on "${field}".`, item, { field, sourceValue: values }));
        item.conflictState = "BLOCKED";
      }
      if (values.length) item.normalizedValues[field] = sourceRecords.map((record) => record.data[field]).find((value) => normalizeLogicalText(value) === values[0]);
    }
    const parentKey = resolvedParentKey(first, identity.entityType, input.planYear);
    if (identity.entityType === "departmental_goal" && !normalizeLogicalText(first.data.strategicGoal)) {
      errors.push(error("INVALID_SOURCE", "A departmental goal must reference an authoritative strategic goal; unresolved source values remain ambiguous.", item, { field: "strategicGoal", sourceValue: first.data.strategicGoal ?? first.data.goal }));
      item.conflictState = "BLOCKED";
    }
    if (parentKey) {
      const parentExists = groups.has(parentKey) || parentKeys.has(parentKey);
      if (!parentExists) {
        errors.push(error("MISSING_PARENT", `No logical parent exists for "${identity.key}".`, item));
        item.conflictState = "BLOCKED";
      } else {
        const parentTitle = parentKey.split("|").at(-1) ?? "";
        item.parent = { relation: "PARENT", entityType: parentType[identity.entityType]!, logicalKey: parentKey, title: parentTitle, planYear: input.planYear };
      }
    }
    const action = identity.entityType === "action";
    if (action) {
      const required: Array<[string, unknown]> = [["action", item.normalizedValues.action], ["deliverable", item.normalizedValues.deliverable], ["startDate", item.normalizedValues.startDate], ["endDate", item.normalizedValues.endDate], ["workType", item.normalizedValues.workType], ["status", item.normalizedValues.status]];
      for (const [field, value] of required) if (!normalizeLogicalText(value)) {
        errors.push(error("INVALID_SOURCE", `Required work-item field "${field}" is missing.`, item, { field }));
        item.conflictState = "BLOCKED";
      }
      if (item.normalizedValues.startDate && !date(item.normalizedValues.startDate)) { errors.push(error("INVALID_SOURCE", "Invalid start date.", item, { field: "startDate" })); item.conflictState = "BLOCKED"; }
      if (item.normalizedValues.endDate && !date(item.normalizedValues.endDate)) { errors.push(error("INVALID_SOURCE", "Invalid end date.", item, { field: "endDate" })); item.conflictState = "BLOCKED"; }
      if (item.normalizedValues.workType && !workTypes.has(String(item.normalizedValues.workType))) { errors.push(error("INVALID_SOURCE", "Invalid work type.", item, { field: "workType" })); item.conflictState = "BLOCKED"; }
    }
    for (const record of sourceRecords) {
      for (const [field, targetType, resolver] of [["owner", "PERSON", input.responsibility?.resolvePerson], ["executor", "PERSON", input.responsibility?.resolvePerson], ["department", "UNIT", input.responsibility?.resolveUnit], ["unit", "UNIT", input.responsibility?.resolveUnit]] as const) {
        if (record.data[field] !== undefined && resolver) {
          const result = resolver(record.data[field], record);
          item.responsibility.push({ ...result, field, targetType });
          if (!result.resolved) { errors.push(error("INVALID_SOURCE", result.reason ?? `Unable to resolve ${field}.`, item, { field, sourceValue: record.data[field], targetType })); item.conflictState = "BLOCKED"; }
        }
      }
    }
    const canonical = input.canonical?.findByLogicalIdentity(item.logicalIdentity);
    if (canonical) {
      item.canonicalReference = canonical;
      const equivalent = stable(canonical.values) === stable(item.normalizedValues);
      if (!equivalent || (!input.allowReuseFromSameImport && canonical.importJobId !== job.id)) {
        errors.push(error("CANONICAL_CONFLICT", equivalent ? "Equivalent canonical identity is from another import and reuse is prohibited." : "Canonical identity has conflicting values.", item));
        item.conflictState = "BLOCKED";
      } else item.conflictState = "REUSE";
    }
    items.push(item);
  }
  const byType = new Map<MaterializableEntityType, number>();
  for (const item of items) {
    const ordinal = (byType.get(item.entityType) ?? 0) + 1;
    byType.set(item.entityType, ordinal);
    item.ordering.ordinal = ordinal;
    item.canonicalAllocation.ordinal = ordinal;
  }
  const summary = {
    goals: items.filter((item) => item.entityType === "goal").length,
    objectives: items.filter((item) => item.entityType === "objective").length,
    activities: items.filter((item) => item.entityType === "activity").length,
    workItems: items.filter((item) => item.entityType === "action").length,
    sourceRecords: records.length,
    blockedItems: items.filter((item) => item.conflictState === "BLOCKED").length
  };
  const base = { status: errors.length ? "BLOCKED" as const : "READY" as const, importJobId: job.id, approvedAnalysisRevision: request.approvedAnalysisRevision, sourceSnapshot: snapshot, planYear: input.planYear, items, summary, errors, warnings };
  return { ...base, planHash: materializationPlanHash(base) };
}
