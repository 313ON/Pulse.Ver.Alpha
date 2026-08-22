import ExcelJS from "exceljs";
import { normalizeImportText } from "../../normalization";
import type {
  CellContract,
  MergedCellRange,
  RowContract,
  SheetContract,
  SpreadsheetCellValue,
  WorkbookContract
} from "../contracts";

export type XlsxBinaryInput = ArrayBuffer | Uint8Array;

export type XlsxWorkbookReaderOptions = {
  name?: string;
};

export const XLSX_LIMITS = {
  maxWorksheets: 20,
  maxRowsPerWorksheet: 10_000,
  maxColumnsPerWorksheet: 200
} as const;

export class XlsxWorkbookError extends Error {}

export function hasXlsxZipSignature(input: XlsxBinaryInput): boolean {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return bytes.length >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && bytes[2] === 0x03
    && bytes[3] === 0x04;
}

export class XlsxWorkbookReader {
  async read(input: XlsxBinaryInput, options: XlsxWorkbookReaderOptions = {}): Promise<WorkbookContract> {
    if (!hasXlsxZipSignature(input)) {
      throw new XlsxWorkbookError("The uploaded file is not a valid XLSX container.");
    }

    const workbook = new ExcelJS.Workbook();
    try {
      const buffer = Buffer.from(input instanceof Uint8Array ? input : new Uint8Array(input));
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch {
      throw new XlsxWorkbookError("The uploaded workbook could not be read.");
    }

    if (workbook.worksheets.length > XLSX_LIMITS.maxWorksheets) {
      throw new XlsxWorkbookError("The uploaded workbook contains too many worksheets.");
    }

    return {
      name: options.name ?? "workbook",
      sheets: workbook.worksheets.map((worksheet, index) => this.readSheet(worksheet, index))
    };
  }

  private readSheet(sheet: ExcelJS.Worksheet, sheetIndex: number): SheetContract {
    if (sheet.rowCount > XLSX_LIMITS.maxRowsPerWorksheet) {
      throw new XlsxWorkbookError("The uploaded worksheet contains too many rows.");
    }
    if (sheet.columnCount > XLSX_LIMITS.maxColumnsPerWorksheet) {
      throw new XlsxWorkbookError("The uploaded worksheet contains too many columns.");
    }

    const rows: RowContract[] = [];

    for (let rowIndex = 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
      const rawValues: SpreadsheetCellValue[] = [];
      const cells: CellContract[] = [];
      const row = sheet.getRow(rowIndex);

      for (let columnIndex = 1; columnIndex <= sheet.columnCount; columnIndex += 1) {
        const rawValue = this.rawValue(row.getCell(columnIndex));
        rawValues.push(rawValue);
        cells.push({
          column: this.encodeColumn(columnIndex),
          rawValue,
          normalizedValue: typeof rawValue === "string" ? normalizeImportText(rawValue) : String(rawValue ?? "")
        });
      }

      rows.push({
        index: rowIndex - 1,
        cells,
        rawValues,
        rowType: rawValues.every((value) => value === undefined || value === null || value === "")
          ? "empty"
          : undefined
      });
    }

    return {
      name: sheet.name,
      rows,
      metadata: {
        sheetIndex,
        range: this.rangeForSheet(sheet),
        mergedCells: sheet.model.merges.map((merge) => this.toMergedCellRange(merge))
      }
    };
  }

  private toMergedCellRange(merge: string): MergedCellRange {
    const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(merge);
    if (!match) throw new XlsxWorkbookError("The uploaded workbook contains an invalid merged-cell range.");
    return {
      startColumn: match[1].toUpperCase(),
      startRow: Number(match[2]) - 1,
      endColumn: match[3].toUpperCase(),
      endRow: Number(match[4]) - 1
    };
  }

  private rangeForSheet(sheet: ExcelJS.Worksheet): string | undefined {
    if (sheet.rowCount === 0 || sheet.columnCount === 0) return undefined;
    return `A1:${this.encodeColumn(sheet.columnCount)}${sheet.rowCount}`;
  }

  private rawValue(cell: ExcelJS.Cell): SpreadsheetCellValue {
    if (cell.isMerged && cell.address !== cell.master.address) return undefined;
    const value = cell.value;
    if (value && typeof value === "object" && "formula" in value) {
      return this.rawValueValue(value.result);
    }
    return this.rawValueValue(value);
  }

  private rawValueValue(value: unknown): SpreadsheetCellValue {
    if (value === null) return undefined;
    if (
      value === undefined
      || typeof value === "string"
      || typeof value === "number"
      || typeof value === "boolean"
      || value instanceof Date
    ) {
      return value as SpreadsheetCellValue;
    }
    if (typeof value === "object" && "text" in value) {
      return String(value.text);
    }
    return String(value);
  }

  private encodeColumn(column: number): string {
    let value = column;
    let result = "";
    while (value > 0) {
      const remainder = (value - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      value = Math.floor((value - 1) / 26);
    }
    return result;
  }
}
