export type SpreadsheetCellValue = string | number | boolean | Date | null | undefined;

export type CellContract = {
  column: string;
  rawValue: SpreadsheetCellValue;
  normalizedValue: string;
};

export type RowContract = {
  index: number;
  cells: CellContract[];
  rawValues: SpreadsheetCellValue[];
  rowType?: "data" | "hierarchy" | "continuation" | "empty";
  metadata?: RowMetadata;
};

export type RowMetadata = {
  hierarchyLevel?: number;
  repeatedHierarchy?: boolean;
  continuationOfRowIndex?: number;
  [key: string]: unknown;
};

export type MergedCellRange = {
  startColumn: string;
  startRow: number;
  endColumn: string;
  endRow: number;
};

export type SheetMetadata = {
  mergedCells?: MergedCellRange[];
  headerRowIndex?: number;
  [key: string]: unknown;
};

export type SheetContract = {
  name: string;
  rows: RowContract[];
  metadata: SheetMetadata;
};

export type WorkbookContract = {
  name: string;
  sheets: SheetContract[];
};
