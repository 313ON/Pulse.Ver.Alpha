import type { ImportRecord } from "../../contracts";
import type { ColumnSemanticType } from "../mapping";

export const EVALUATION_FAILURE_CATEGORIES = [
  "UNKNOWN_HEADER",
  "AMBIGUOUS_HEADER",
  "MISSING_VALUE",
  "INVALID_HIERARCHY",
  "INHERITANCE_FAILURE",
  "UNRESOLVED_ASSIGNMENT",
  "UNSUPPORTED_STRUCTURE",
  "SOURCE_TRACE_FAILURE"
] as const;

export type EvaluationFailureCategory = typeof EVALUATION_FAILURE_CATEGORIES[number];
export type EvaluationStatus = "PASS" | "FAIL";

export type WorkbookProvenance = {
  workbookName: string;
  sourceType: "EXCEL";
  sheetCount: number;
};

export type SheetProvenance = {
  workbookName: string;
  sheetName: string;
  sheetIndex: number;
  headerRowIndex?: number;
};

export type RowProvenance = SheetProvenance & {
  rowIndex: number;
  sourceRowNumber: number;
};

export type CellProvenance = RowProvenance & {
  column: string;
  address: string;
  header?: string;
  semanticType?: ColumnSemanticType;
  rawValue: unknown;
};

export type EvaluationIssue = {
  category: EvaluationFailureCategory;
  message: string;
  provenance?: SheetProvenance | RowProvenance | CellProvenance;
  recordId?: string;
};

export type SemanticCheck = {
  name: "header-detection" | "semantic-values" | "hierarchy" | "assignments" | "source-trace";
  status: EvaluationStatus;
  issues: EvaluationIssue[];
};

export type RowEvaluation = {
  provenance: RowProvenance;
  recordId?: string;
  entityType?: ImportRecord["entityType"];
  status: EvaluationStatus;
  cells: CellProvenance[];
  issues: EvaluationIssue[];
};

export type SheetEvaluation = {
  provenance: SheetProvenance;
  checks: SemanticCheck[];
  rows: RowEvaluation[];
  unknownHeaders: string[];
  ambiguousHeaders: string[];
};

export type EvaluationSummary = {
  totalSheets: number;
  totalRows: number;
  mappedRecords: number;
  passedChecks: number;
  failedChecks: number;
  unknownHeaders: number;
  ambiguousHeaders: number;
  issueCounts: Record<EvaluationFailureCategory, number>;
  scorePercent: number;
  status: EvaluationStatus;
};

export type SpreadsheetEvaluationReport = {
  workbook: WorkbookProvenance;
  sheets: SheetEvaluation[];
  summary: EvaluationSummary;
};
