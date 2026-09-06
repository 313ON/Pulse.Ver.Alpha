import type { ImportRecord } from "../import/contracts";
import { normalizeImportText } from "../import/normalization";
import type { LogicalEntityIdentity, MaterializableEntityType } from "./contracts";
import { normalizeSemanticText } from "../import/spreadsheet/semantic/MasterPlanSemantics";

export function normalizeLogicalText(value: unknown): string {
  const normalized = normalizeImportText(String(value ?? ""))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/^\s*\d+\s*[-–—.)]\s*/u, "")
    .replace(/[.،,؛;:]+$/u, "")
    .replace(/هوشمند\s+سازی/gu, "هوشمندسازی")
    .replace(/فرآیندها/gu, "فرایندها")
    .replace(/بهره\s+وری/gu, "بهره وری")
    .replace(/زیر\s+ساخت/gu, "زیرساخت")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
  if (normalized === "هدف اصلی") return "";
  if (normalized.includes("تکمیل چرخه آزمایشگاهی")) return "goal:lab-cycle";
  if (normalized.includes("دستیابی به تولید و فروش")) return "goal:planned-production";
  if (normalized.includes("توسعه") && (normalized.includes("یوتیلیتی") || normalized.includes("utilit"))) return "goal:utilities";
  if (normalized.includes("افزایش دانش") || normalized === "افزایش دانش و مهارت") return "goal:knowledge";
  if (normalized.includes("کاهش پرت حامل")) return "goal:energy-waste";
  if (normalized.includes("افزایش بهره") && normalized.includes("امکانات")) return "goal:equipment-productivity";
  if (normalized.includes("ارتقا") || normalized.includes("ارتقاء")) if (normalized.includes("بهداشت حرفه")) return "goal:health-safety";
  if (normalized.includes("معرفی") && normalized.includes("دانش محور")) return "goal:knowledge-company";
  if (normalized.includes("هوشمند") && (normalized.includes("فرایند") || normalized.includes("فرآیند"))) return "goal:smart-processes";
  if (normalized.includes("حفظ محیط زیست")) return "goal:environment";
  return normalized;
}

function value(record: ImportRecord, key: string): string {
  return key === "goal"
    ? normalizeSemanticText(record.data[key])
    : normalizeLogicalText(record.data[key]);
}

export function logicalEntityIdentity(record: ImportRecord, planYear: number): LogicalEntityIdentity {
  const entityType = record.entityType as MaterializableEntityType;
  const titleKey = entityType === "goal" ? "goal"
    : entityType === "departmental_goal" ? "departmentalGoal"
    : entityType === "objective" ? "objective"
      : entityType === "activity" ? "activity"
        : "action";
  const title = value(record, titleKey);
  if (!title) throw new Error(`Import record "${record.id}" has no ${entityType} title.`);

  const goal = value(record, "goal");
  const departmentalGoal = value(record, "departmentalGoal");
  const objective = value(record, "objective");
  const activity = value(record, "activity");
  const strategicKey = `goal|${planYear}|${goal}`;
  const departmentalKey = `departmental_goal|${planYear}|${strategicKey}|${departmentalGoal}`;
  const objectiveKey = `objective|${planYear}|${departmentalGoal ? `${goal}|${departmentalGoal}|` : `${goal}|`}${objective}`;
  const parentKey = entityType === "goal" ? undefined
    : entityType === "departmental_goal" ? `goal|${planYear}|${value(record, "strategicGoal") || goal}`
    : entityType === "objective" ? (departmentalGoal ? departmentalKey : strategicKey)
      : entityType === "activity" ? objectiveKey
        : `activity|${planYear}|${goal}|${departmentalGoal ? `${departmentalGoal}|` : ""}${objective}|${activity}`;
  const actionSuffix = entityType === "action" && value(record, "sourceCode") ? `|${value(record, "sourceCode")}` : "";
  const key = `${entityType}|${planYear}|${parentKey ? `${parentKey}|` : ""}${title}${actionSuffix}`;
  return { entityType, planYear, title, key, parentKey };
}

export function groupByLogicalIdentity(records: ImportRecord[], planYear: number): Map<string, ImportRecord[]> {
  const groups = new Map<string, ImportRecord[]>();
  for (const record of records) {
    if (!["goal", "departmental_goal", "objective", "activity", "action"].includes(record.entityType)) continue;
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
