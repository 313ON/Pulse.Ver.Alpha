import type { ColumnSemanticType } from "../mapping";

export type NormalizationStatus = "NORMALIZED" | "PRESERVED" | "EMPTY" | "INVALID" | "AMBIGUOUS";

export type NormalizedProvenance = {
  workbook: string;
  sheet: string;
  row: number;
  column: string;
  cell: string;
  sheetIndex: number;
  sourceRowNumber: number;
};

export type NormalizedField = {
  rawValue: unknown;
  normalizedValue: unknown;
  semanticType: ColumnSemanticType;
  status: NormalizationStatus;
  provenance: NormalizedProvenance;
  identityType?: AssignmentIdentityType;
};

export type AssignmentIdentityType = "UNIT" | "PERSON" | "UNKNOWN";

export type NormalizedAssignment = NormalizedField & {
  identityType: AssignmentIdentityType;
};

export type NormalizedImportRecord = {
  id: string;
  externalId?: string;
  entityType: string;
  source: {
    type: "EXCEL";
    name: string;
    metadata: Record<string, unknown>;
  };
  rowNumber?: number;
  data: Record<string, NormalizedField | NormalizedAssignment>;
};

export type NormalizedSpreadsheetResult = {
  workbook: string;
  records: NormalizedImportRecord[];
};
