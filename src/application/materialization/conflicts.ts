import type { ImportRecord } from "../import/contracts";
import type { MaterializationConflict, MaterializableEntityType } from "./contracts";
import { groupByLogicalIdentity, logicalEntityIdentity, normalizeLogicalText } from "./identity";

const comparableFields: Record<MaterializableEntityType, string[]> = {
  goal: ["goal"],
  objective: ["goal", "objective"],
  activity: ["goal", "objective", "activity", "description"],
  action: ["goal", "objective", "activity", "action", "executor", "collaborator", "startDate", "endDate", "deliverable"]
};

export function classifyIdentityConflicts(records: ImportRecord[], planYear: number): MaterializationConflict[] {
  const conflicts: MaterializationConflict[] = [];
  for (const [identityKey, group] of groupByLogicalIdentity(records, planYear)) {
    const fields = comparableFields[group[0].entityType as MaterializableEntityType];
    for (const field of fields) {
      const values = new Set(group.map((record) => normalizeLogicalText(record.data[field])).filter(Boolean));
      if (values.size > 1) {
        conflicts.push({
          code: "IDENTITY_COLLISION",
          entityType: group[0].entityType as MaterializableEntityType,
          identityKey,
          recordIds: group.map((record) => record.id),
          message: `Records for "${identityKey}" disagree on "${field}".`
        });
      }
    }
  }
  return conflicts;
}

export function classifyCanonicalConflict(input: {
  entityType: MaterializableEntityType;
  identityKey: string;
  sourceRecordIds: string[];
  canonicalExists: boolean;
  equivalent: boolean;
  originatedByAnotherImport: boolean;
}): MaterializationConflict[] {
  if (!input.canonicalExists || (input.equivalent && !input.originatedByAnotherImport)) return [];
  return [{
    code: "CANONICAL_CONFLICT",
    entityType: input.entityType,
    identityKey: input.identityKey,
    recordIds: input.sourceRecordIds,
    message: input.originatedByAnotherImport
      ? "An equivalent canonical entity originated from another import and reuse is not enabled."
      : "A canonical entity with a differing value already exists."
  }];
}

export function assertLogicalEntityType(record: ImportRecord): void {
  if (!["goal", "objective", "activity", "action"].includes(record.entityType)) {
    throw new Error(`Entity type "${record.entityType}" is not materializable.`);
  }
  logicalEntityIdentity(record, 1405);
}
