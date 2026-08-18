import { createProgramDate, normalizeProgramDigits } from "../../domain/program";
import type { Assignment } from "../../domain/program";
import type {
  ImportRecord,
  ImportValidationIssue,
  ImportValidationResult,
  ExternalDataRecord
} from "./contracts";

export type ReferenceResolution = {
  resolved: boolean;
  entityId?: string;
  displayName?: string;
  message?: string;
};

export type ImportNormalizationHooks = {
  isDuplicate?: (record: ImportRecord, normalizedRecords: ImportRecord[]) => boolean | string;
  resolvePerson?: (reference: { entityId?: string; displayName?: string }) => ReferenceResolution;
  resolveUnit?: (reference: { entityId?: string; displayName?: string }) => ReferenceResolution;
};

export type NormalizedJalaliDate = {
  valid: boolean;
  value?: string;
  error?: string;
};

const DATE_KEYS = new Set([
  "date", "start", "end", "deadline", "plannedStart", "plannedEnd",
  "planned_start", "planned_end", "actualCompletion", "actual_completion"
]);

export function normalizeImportText(value: string): string {
  return normalizeProgramDigits(value).replace(/\s+/g, " ").trim();
}

export function normalizeJalaliDate(value: unknown): NormalizedJalaliDate {
  if (value === undefined || value === null || value === "") return { valid: false, error: "Date is required." };
  const normalized = normalizeImportText(String(value)).replace(/[-.]/g, "/");
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return { valid: false, error: "Date must use the Jalali YYYY/MM/DD format." };
  const [, year, monthText, dayText] = match;
  const month = Number(monthText);
  const day = Number(dayText);
  const maxDay = month <= 6 ? 31 : month <= 11 ? 30 : 30;
  if (month < 1 || month > 12 || day < 1 || day > maxDay) {
    return { valid: false, error: "Date is outside the valid Jalali calendar range." };
  }
  const canonical = `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
  try {
    createProgramDate(canonical);
  } catch {
    return { valid: false, error: "Date is not a valid program date." };
  }
  return { valid: true, value: canonical };
}

export class ImportNormalizer {
  normalize(records: ImportRecord[], hooks: ImportNormalizationHooks = {}): ImportValidationResult {
    const errors: ImportValidationIssue[] = [];
    const warnings: ImportValidationIssue[] = [];
    const normalizedData: ImportRecord[] = [];
    const seen = new Set<string>();

    for (const record of records) {
      const normalizedRecord = {
        ...record,
        id: normalizeImportText(record.id),
        externalId: record.externalId ? normalizeImportText(record.externalId) : undefined,
        data: this.normalizeData(record.data, record, errors, hooks)
      };
      const duplicateKey = `${normalizedRecord.entityType}:${normalizedRecord.externalId ?? normalizedRecord.id}`;
      if (seen.has(duplicateKey) || hooks.isDuplicate?.(normalizedRecord, normalizedData)) {
        errors.push({
          code: "DUPLICATE_RECORD",
          message: `Duplicate import record detected: ${duplicateKey}.`,
          severity: "error",
          recordId: normalizedRecord.id,
          entityType: normalizedRecord.entityType
        });
      }
      seen.add(duplicateKey);
      normalizedData.push(normalizedRecord);
    }
    return { valid: errors.length === 0, errors, warnings, normalizedData };
  }

  fromExternal(records: ExternalDataRecord[], hooks: ImportNormalizationHooks = {}): ImportValidationResult {
    return this.normalize(records.map((record) => ({
      id: record.externalId,
      externalId: record.externalId,
      entityType: record.entityType,
      source: record.source,
      data: record.fields,
      rowNumber: record.rowNumber
    })), hooks);
  }

  private normalizeData(
    data: Record<string, unknown>,
    record: ImportRecord,
    errors: ImportValidationIssue[],
    hooks: ImportNormalizationHooks
  ): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") {
        const text = normalizeImportText(value);
        if (DATE_KEYS.has(key) && text) {
          const date = normalizeJalaliDate(text);
          if (!date.valid) {
            errors.push({ code: "INVALID_DATE", message: date.error ?? "Invalid Jalali date.", severity: "error", recordId: record.id, entityType: record.entityType, field: key });
          } else {
            normalized[key] = date.value;
            continue;
          }
        }
        normalized[key] = text;
      } else if (key === "assignments" && Array.isArray(value)) {
        normalized[key] = this.normalizeAssignments(value, record, errors, hooks);
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  }

  private normalizeAssignments(
    value: unknown[],
    record: ImportRecord,
    errors: ImportValidationIssue[],
    hooks: ImportNormalizationHooks
  ): Assignment[] {
    return value.filter((item): item is Assignment => Boolean(item && typeof item === "object")).map((item) => {
      const assignment = item as Assignment;
      const resolver = assignment.entityType === "PERSON" ? hooks.resolvePerson : hooks.resolveUnit;
      const resolution = resolver?.({ entityId: assignment.entityId, displayName: assignment.displayName });
      if (resolution && !resolution.resolved) {
        errors.push({ code: "REFERENCE_UNRESOLVED", message: resolution.message ?? `Unable to resolve ${assignment.entityType} reference.`, severity: "error", recordId: record.id, entityType: record.entityType, field: "assignments" });
      }
      return {
        ...assignment,
        entityId: normalizeImportText(resolution?.entityId ?? assignment.entityId),
        displayName: normalizeImportText(resolution?.displayName ?? assignment.displayName)
      };
    });
  }
}

export function normalizeImportRecords(records: ImportRecord[], hooks?: ImportNormalizationHooks): ImportValidationResult {
  return new ImportNormalizer().normalize(records, hooks);
}

