import type { ImportRecord } from "../import/contracts";
import { normalizeImportText } from "../import/normalization";
import type { LogicalEntityIdentity, MaterializableEntityType } from "./contracts";

export function normalizeLogicalText(value: unknown): string {
  return normalizeImportText(String(value ?? ""))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function value(record: ImportRecord, key: string): string {
  return normalizeLogicalText(record.data[key]);
}

export function logicalEntityIdentity(record: ImportRecord, planYear: number): LogicalEntityIdentity {
  const entityType = record.entityType as MaterializableEntityType;
  const titleKey = entityType === "goal" ? "goal"
    : entityType === "objective" ? "objective"
      : entityType === "activity" ? "activity"
        : "action";
  const title = value(record, titleKey);
  if (!title) throw new Error(`Import record "${record.id}" has no ${entityType} title.`);

  const goal = value(record, "goal");
  const objective = value(record, "objective");
  const activity = value(record, "activity");
  const parentKey = entityType === "goal" ? undefined
    : entityType === "objective" ? `goal|${planYear}|${goal}`
      : entityType === "activity" ? `objective|${planYear}|${goal}|${objective}`
        : `activity|${planYear}|${goal}|${objective}|${activity}`;
  const key = `${entityType}|${planYear}|${parentKey ? `${parentKey}|` : ""}${title}`;
  return { entityType, planYear, title, key, parentKey };
}

export function groupByLogicalIdentity(records: ImportRecord[], planYear: number): Map<string, ImportRecord[]> {
  const groups = new Map<string, ImportRecord[]>();
  for (const record of records) {
    if (!["goal", "objective", "activity", "action"].includes(record.entityType)) continue;
    const identity = logicalEntityIdentity(record, planYear);
    const current = groups.get(identity.key) ?? [];
    current.push(record);
    groups.set(identity.key, current);
  }
  return groups;
}

export function logicalIdentityForValues(
  entityType: MaterializableEntityType,
  planYear: number,
  values: { goal?: string; objective?: string; activity?: string; action?: string }
): LogicalEntityIdentity {
  return logicalEntityIdentity({
    id: `identity-${entityType}`,
    entityType,
    source: { type: "MANUAL", name: "logical-identity", metadata: {} },
    data: values
  }, planYear);
}
