import { normalizeImportText } from "../../normalization";

export type RaciType = "R" | "A" | "C" | "I";
export type AssignmentTargetType = "DEPARTMENT" | "POSITION" | "PERSON" | "UNRESOLVED";

export type RaciAssignment = {
  raciType: RaciType;
  displayName: string;
  normalizedName: string;
  targetType: AssignmentTargetType;
  targetId?: string;
  resolved: boolean;
};

const splitPattern = /\s*(?:\/|،|,|؛|;|\||\n)\s*/u;

export function normalizeAssignmentText(value: unknown): string {
  return normalizeImportText(String(value ?? ""))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitRaciParticipants(value: unknown): string[] {
  const normalized = normalizeAssignmentText(value);
  if (!normalized || normalized === "—" || normalized === "-") return [];
  return normalized.split(splitPattern).map((item) => item.trim()).filter(Boolean);
}

export function extractRaciAssignments(data: Record<string, unknown>): RaciAssignment[] {
  const fields: Array<[RaciType, string]> = [["R", "responsible"], ["A", "accountable"], ["C", "consulted"], ["I", "informed"]];
  return fields.flatMap(([raciType, field]) => splitRaciParticipants(data[field]).map((displayName) => ({
    raciType,
    displayName,
    normalizedName: normalizeAssignmentText(displayName).toLocaleLowerCase(),
    targetType: "UNRESOLVED" as const,
    resolved: false
  })));
}
