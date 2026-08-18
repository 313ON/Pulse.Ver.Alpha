import type { ImportRecord } from "../../contracts";
import type { CellContract, RowContract, SheetContract, WorkbookContract } from "../contracts";
import { HIERARCHY_SEMANTIC_TYPES, SEMANTIC_DATA_KEYS, type ColumnSemanticType } from "../mapping";
import { HeaderSemanticResolver, type ResolvedSemanticColumn } from "../mapping";
import type {
  AssignmentIdentityType,
  NormalizedField,
  NormalizedImportRecord,
  NormalizedProvenance,
  NormalizedSpreadsheetResult,
  NormalizationStatus
} from "./contracts";

const DATE_TYPES: ColumnSemanticType[] = ["START_DATE", "END_DATE"];

export class SpreadsheetNormalizationEngine {
  constructor(private readonly resolver = new HeaderSemanticResolver()) {}

  normalize(workbook: WorkbookContract, records: ImportRecord[]): NormalizedSpreadsheetResult {
    const normalizedRecords = workbook.sheets.flatMap((sheet, sheetIndex) => {
      const sheetRecords = records.filter((record) =>
        record.source.metadata.sheetName === sheet.name &&
        record.source.metadata.sheetIndex === sheetIndex
      );
      return this.normalizeSheet(workbook, sheet, sheetIndex, sheetRecords);
    });
    return { workbook: workbook.name, records: normalizedRecords };
  }

  normalizeMapping(workbook: WorkbookContract, records: ImportRecord[]): NormalizedSpreadsheetResult {
    return this.normalize(workbook, records);
  }

  normalizeWorkbook(workbook: WorkbookContract, records: ImportRecord[]): NormalizedSpreadsheetResult {
    return this.normalize(workbook, records);
  }

  private normalizeSheet(
    workbook: WorkbookContract,
    sheet: SheetContract,
    sheetIndex: number,
    records: ImportRecord[]
  ): NormalizedImportRecord[] {
    const headerRowIndex = sheet.metadata.headerRowIndex ?? 0;
    const headerRow = this.findRow(sheet, headerRowIndex);
    if (!headerRow) return [];
    const columns = this.resolver.resolveRow(headerRow);
    const sources = new Map<ColumnSemanticType, { cell: CellContract; row: RowContract }>();
    const output: NormalizedImportRecord[] = [];

    for (const row of sheet.rows) {
      if (row.index <= headerRow.index || row.rowType === "empty") continue;
      const cells = this.cellsForRow(row, columns);
      this.updateHierarchy(cells, sources);
      const record = records.find((candidate) => candidate.rowNumber === row.index);
      if (!record) continue;

      const data: Record<string, NormalizedField> = {};
      for (const semanticType of HIERARCHY_SEMANTIC_TYPES) {
        const source = sources.get(semanticType);
        if (source) data[SEMANTIC_DATA_KEYS[semanticType]] = this.field(
          source.cell.rawValue, semanticType, workbook, sheet, source.row, source.cell, sheetIndex,
          this.ambiguous(columns, semanticType)
        );
      }
      for (const column of columns) {
        if (HIERARCHY_SEMANTIC_TYPES.includes(column.semanticType)) continue;
        const cell = row.cells.find((candidate) => candidate.column === column.column);
        if (!cell || this.empty(cell.rawValue)) continue;
        const key = SEMANTIC_DATA_KEYS[column.semanticType];
        if (data[key]) {
          data[key] = this.ambiguousField(data[key], cell);
        } else {
          data[key] = this.field(cell.rawValue, column.semanticType, workbook, sheet, row, cell, sheetIndex,
            this.ambiguous(columns, column.semanticType));
        }
      }
      output.push({
        ...record,
        source: { ...record.source, type: "EXCEL" },
        data
      });
    }
    return output;
  }

  private cellsForRow(row: RowContract, columns: ResolvedSemanticColumn[]) {
    return columns.flatMap((column) => {
      const cell = row.cells.find((candidate) => candidate.column === column.column);
      return cell && !this.empty(cell.rawValue) ? [{ ...column, cell, row }] : [];
    });
  }

  private updateHierarchy(
    values: Array<ResolvedSemanticColumn & { cell: CellContract; row: RowContract }>,
    sources: Map<ColumnSemanticType, { cell: CellContract; row: RowContract }>
  ) {
    for (const semanticType of HIERARCHY_SEMANTIC_TYPES) {
      const value = values.find((candidate) => candidate.semanticType === semanticType);
      if (!value) continue;
      sources.set(semanticType, value);
      const index = HIERARCHY_SEMANTIC_TYPES.indexOf(semanticType);
      HIERARCHY_SEMANTIC_TYPES.slice(index + 1).forEach((descendant) => sources.delete(descendant));
    }
  }

  private field(
    rawValue: unknown,
    semanticType: ColumnSemanticType,
    workbook: WorkbookContract,
    sheet: SheetContract,
    row: RowContract,
    cell: CellContract,
    sheetIndex: number,
    ambiguous: boolean
  ): NormalizedField {
    const provenance = this.provenance(workbook, sheet, row, cell, sheetIndex);
    if (this.empty(rawValue)) return { rawValue, normalizedValue: rawValue, semanticType, status: "EMPTY", provenance };
    if (ambiguous) return { rawValue, normalizedValue: rawValue, semanticType, status: "AMBIGUOUS", provenance };
    if (DATE_TYPES.includes(semanticType)) return this.dateField(rawValue, semanticType, provenance);
    const normalizedValue = this.normalizeValue(rawValue);
    const status: NormalizationStatus = normalizedValue === rawValue ? "PRESERVED" : "NORMALIZED";
    return {
      rawValue,
      normalizedValue,
      semanticType,
      status,
      provenance,
      ...(this.isAssignment(semanticType) ? { identityType: assignmentIdentityType(semanticType) } : {})
    };
  }

  private dateField(rawValue: unknown, semanticType: ColumnSemanticType, provenance: NormalizedProvenance): NormalizedField {
    if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
      return { rawValue, normalizedValue: rawValue.toISOString().slice(0, 10), semanticType, status: "NORMALIZED", provenance };
    }
    const text = this.normalizeValue(rawValue);
    if (typeof text === "string" && /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(text)) {
      const [year, month, day] = text.split(/[/-]/).map(Number);
      const maxDay = month <= 6 ? 31 : month <= 11 ? 30 : 30;
      if (month >= 1 && month <= 12 && day >= 1 && day <= maxDay) {
        return { rawValue, normalizedValue: `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`, semanticType, status: "NORMALIZED", provenance };
      }
    }
    return { rawValue, normalizedValue: rawValue, semanticType, status: "INVALID", provenance };
  }

  private normalizeValue(value: unknown): unknown {
    if (typeof value !== "string") return value;
    const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
    const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
    return value.normalize("NFKC")
      .replace(/[يى]/g, "ی")
      .replace(/[ك]/g, "ک")
      .replace(/[۰-۹٠-٩]/g, (digit) => {
        const index = persianDigits.indexOf(digit);
        return String(index >= 0 ? index : arabicDigits.indexOf(digit));
      })
      .replace(/\s+/g, " ")
      .trim();
  }

  private ambiguous(columns: ResolvedSemanticColumn[], type: ColumnSemanticType) {
    return columns.filter((column) => column.semanticType === type).length > 1;
  }

  private ambiguousField(previous: NormalizedField, cell: CellContract): NormalizedField {
    return { ...previous, rawValue: [previous.rawValue, cell.rawValue], normalizedValue: [previous.normalizedValue, this.normalizeValue(cell.rawValue)], status: "AMBIGUOUS" };
  }

  private provenance(workbook: WorkbookContract, sheet: SheetContract, row: RowContract, cell: CellContract, sheetIndex: number): NormalizedProvenance {
    return { workbook: workbook.name, sheet: sheet.name, row: row.index, column: cell.column, cell: `${cell.column}${row.index + 1}`, sheetIndex, sourceRowNumber: row.index + 1 };
  }

  private findRow(sheet: SheetContract, index: number) {
    return sheet.rows.find((row) => row.index === index) ?? sheet.rows[index];
  }

  private empty(value: unknown) {
    return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
  }

  private isAssignment(semanticType: ColumnSemanticType): boolean {
    return ["OWNER", "EXECUTOR", "COLLABORATOR", "UNIT", "PERSON"].includes(semanticType);
  }
}

export function assignmentIdentityType(semanticType: ColumnSemanticType): AssignmentIdentityType {
  if (semanticType === "UNIT") return "UNIT";
  if (semanticType === "PERSON") return "PERSON";
  return "UNKNOWN";
}
