import * as XLSX from "xlsx";
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

export class XlsxWorkbookReader {
  read(input: XlsxBinaryInput, options: XlsxWorkbookReaderOptions = {}): WorkbookContract {
    const workbook = XLSX.read(input, {
      type: "array",
      cellDates: true,
      cellNF: true,
      cellText: false
    });

    return {
      name: options.name ?? "workbook",
      sheets: workbook.SheetNames.map((name, index) =>
        this.readSheet(name, workbook.Sheets[name], index)
      )
    };
  }

  private readSheet(name: string, sheet: XLSX.WorkSheet, sheetIndex: number): SheetContract {
    const range = this.readRange(sheet["!ref"]);
    const rows: RowContract[] = [];

    if (range) {
      for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
        const rawValues: SpreadsheetCellValue[] = [];
        const cells: CellContract[] = [];

        for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
          const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
          const rawValue = this.rawValue(sheet[address]?.v);
          rawValues.push(rawValue);
          cells.push({
            column: XLSX.utils.encode_col(columnIndex),
            rawValue,
            normalizedValue: typeof rawValue === "string" ? normalizeImportText(rawValue) : String(rawValue ?? "")
          });
        }

        rows.push({
          index: rowIndex,
          cells,
          rawValues,
          rowType: rawValues.every((value) => value === undefined || value === null || value === "")
            ? "empty"
            : undefined
        });
      }
    }

    return {
      name,
      rows,
      metadata: {
        sheetIndex,
        range: sheet["!ref"],
        mergedCells: (sheet["!merges"] ?? []).map((merge) => this.toMergedCellRange(merge))
      }
    };
  }

  private readRange(reference: string | undefined): {
    startColumn: number;
    startRow: number;
    endColumn: number;
    endRow: number;
  } | undefined {
    if (!reference) return undefined;
    const range = XLSX.utils.decode_range(reference);
    return {
      startColumn: range.s.c,
      startRow: range.s.r,
      endColumn: range.e.c,
      endRow: range.e.r
    };
  }

  private toMergedCellRange(merge: XLSX.Range): MergedCellRange {
    return {
      startColumn: XLSX.utils.encode_col(merge.s.c),
      startRow: merge.s.r,
      endColumn: XLSX.utils.encode_col(merge.e.c),
      endRow: merge.e.r
    };
  }

  private rawValue(value: unknown): SpreadsheetCellValue {
    if (
      value === undefined
      || value === null
      || typeof value === "string"
      || typeof value === "number"
      || typeof value === "boolean"
      || value instanceof Date
    ) {
      return value as SpreadsheetCellValue;
    }
    return String(value);
  }
}
