import type { ProgramNodeType } from "../../domain/program";

export type ImportSourceType = "EXCEL" | "API" | "MANUAL";

export type ImportSource = {
  type: ImportSourceType;
  name: string;
  metadata: Record<string, unknown>;
};

export type ImportEntityType = ProgramNodeType | "assignment";

export type ImportRecord = {
  id: string;
  entityType: ImportEntityType;
  source: ImportSource;
  data: Record<string, unknown>;
  rowNumber?: number;
  externalId?: string;
};

export type ImportValidationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
  recordId?: string;
  entityType?: ImportEntityType;
  field?: string;
};

export type ImportValidationResult = {
  valid: boolean;
  errors: ImportValidationIssue[];
  warnings: ImportValidationIssue[];
  normalizedData: ImportRecord[];
};

export type ExternalDataRecord = {
  source: ImportSource;
  externalId: string;
  entityType: ImportEntityType;
  fields: Record<string, unknown>;
  rowNumber?: number;
};

export type ImportModel = ImportRecord;

