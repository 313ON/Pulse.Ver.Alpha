import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  hasXlsxZipSignature,
  XLSX_LIMITS,
  XlsxWorkbookError,
  XlsxWorkbookReader
} from "./XlsxWorkbookReader";

type SheetFixture = {
  rows: unknown[][];
  merges?: string[];
  configure?: (worksheet: ExcelJS.Worksheet) => void;
};

async function workbookBinary(sheets: Record<string, SheetFixture>): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  Object.entries(sheets).forEach(([name, fixture]) => {
    const worksheet = workbook.addWorksheet(name);
    fixture.rows.forEach((row) => worksheet.addRow(row));
    fixture.merges?.forEach((merge) => worksheet.mergeCells(merge));
    fixture.configure?.(worksheet);
  });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

describe("XlsxWorkbookReader", () => {
  it("extracts a single sheet, rows, cells, and workbook metadata", async () => {
    const result = await new XlsxWorkbookReader().read(await workbookBinary({
      Programs: { rows: [["Goal", "Owner"], ["Improve service", "Nima"]] }
    }), { name: "programs.xlsx" });

    expect(result.name).toBe("programs.xlsx");
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0]).toMatchObject({
      name: "Programs",
      metadata: { range: "A1:B2", sheetIndex: 0 }
    });
    expect(result.sheets[0].rows[0].rawValues).toEqual(["Goal", "Owner"]);
    expect(result.sheets[0].rows[1].cells).toEqual([
      { column: "A", rawValue: "Improve service", normalizedValue: "Improve service" },
      { column: "B", rawValue: "Nima", normalizedValue: "Nima" }
    ]);
  });

  it("extracts multiple sheets in workbook order", async () => {
    const result = await new XlsxWorkbookReader().read(await workbookBinary({
      Goals: { rows: [["Goal"]] },
      Actions: { rows: [["Action"]] }
    }));

    expect(result.sheets.map((sheet) => sheet.name)).toEqual(["Goals", "Actions"]);
    expect(result.sheets.map((sheet) => sheet.metadata.sheetIndex)).toEqual([0, 1]);
  });

  it("preserves empty cells and row indexes across the used range", async () => {
    const result = await new XlsxWorkbookReader().read(await workbookBinary({
      Sheet1: { rows: [["Header", undefined, "Value"], [undefined, "Continuation", undefined]] }
    }));
    const rows = result.sheets[0].rows;

    expect(rows.map((row) => row.index)).toEqual([0, 1]);
    expect(rows[0].rawValues).toEqual(["Header", undefined, "Value"]);
    expect(rows[0].cells[1]).toMatchObject({
      column: "B",
      rawValue: undefined,
      normalizedValue: ""
    });
    expect(rows[1].rawValues).toEqual([undefined, "Continuation", undefined]);
  });

  it("preserves merged cell ranges as metadata", async () => {
    const result = await new XlsxWorkbookReader().read(await workbookBinary({
      Program: {
        rows: [["Program title", undefined, undefined], ["Goal", "Objective", "Action"]],
        merges: ["A1:C1"]
      }
    }));

    expect(result.sheets[0].metadata.mergedCells).toEqual([{
      startColumn: "A",
      startRow: 0,
      endColumn: "C",
      endRow: 0
    }]);
    expect(result.sheets[0].rows[0].rawValues).toEqual(["Program title", undefined, undefined]);
  });

  it("preserves Persian and English text, dates, and formula results without evaluating formulas", async () => {
    const result = await new XlsxWorkbookReader().read(await workbookBinary({
      Mixed: {
        rows: [
          ["هدف", "Owner", "تاریخ", "Formula"],
          ["بهبود کیفیت", "Nima", new Date("2026-08-22T00:00:00.000Z"), undefined]
        ],
        configure: (worksheet) => {
          worksheet.getCell("D2").value = { formula: "1+1" };
        }
      }
    }));
    const row = result.sheets[0].rows[1];

    expect(row.cells[0].rawValue).toBe("بهبود کیفیت");
    expect(row.cells[1].rawValue).toBe("Nima");
    expect(row.cells[2].rawValue).toBeInstanceOf(Date);
    expect(row.cells[3].rawValue).toBeUndefined();
  });

  it("rejects invalid signatures and malformed workbooks", async () => {
    expect(hasXlsxZipSignature(new Uint8Array([1, 2, 3, 4]))).toBe(false);
    await expect(new XlsxWorkbookReader().read(new Uint8Array([1, 2, 3, 4]))).rejects.toBeInstanceOf(XlsxWorkbookError);
    expect(hasXlsxZipSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
    await expect(new XlsxWorkbookReader().read(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).rejects.toBeInstanceOf(XlsxWorkbookError);
  });

  it("rejects workbooks exceeding worksheet, row, and column limits", async () => {
    const manySheets = Object.fromEntries(
      Array.from({ length: XLSX_LIMITS.maxWorksheets + 1 }, (_, index) => [`Sheet${index}`, { rows: [["value"]] }])
    );
    await expect(new XlsxWorkbookReader().read(await workbookBinary(manySheets))).rejects.toBeInstanceOf(XlsxWorkbookError);

    const manyRows = Array.from({ length: XLSX_LIMITS.maxRowsPerWorksheet + 1 }, (_, index) => [index]);
    await expect(new XlsxWorkbookReader().read(await workbookBinary({ Rows: { rows: manyRows } }))).rejects.toBeInstanceOf(XlsxWorkbookError);

    const manyColumns = [Array.from({ length: XLSX_LIMITS.maxColumnsPerWorksheet + 1 }, (_, index) => index)];
    await expect(new XlsxWorkbookReader().read(await workbookBinary({ Columns: { rows: manyColumns } }))).rejects.toBeInstanceOf(XlsxWorkbookError);
  });
});
