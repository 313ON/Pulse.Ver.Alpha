import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { XlsxWorkbookReader } from "./XlsxWorkbookReader";

function workbookBinary(sheets: Record<string, XLSX.WorkSheet>): Uint8Array {
  return XLSX.write({
    SheetNames: Object.keys(sheets),
    Sheets: sheets
  }, { bookType: "xlsx", type: "array" });
}

describe("XlsxWorkbookReader", () => {
  it("extracts a single sheet, rows, cells, and workbook metadata", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Goal", "Owner"],
      ["Improve service", "Nima"]
    ]);

    const result = new XlsxWorkbookReader().read(
      workbookBinary({ Programs: sheet }),
      { name: "programs.xlsx" }
    );

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

  it("extracts multiple sheets in workbook order", () => {
    const result = new XlsxWorkbookReader().read(workbookBinary({
      Goals: XLSX.utils.aoa_to_sheet([["Goal"]]),
      Actions: XLSX.utils.aoa_to_sheet([["Action"]])
    }));

    expect(result.sheets.map((sheet) => sheet.name)).toEqual(["Goals", "Actions"]);
    expect(result.sheets.map((sheet) => sheet.metadata.sheetIndex)).toEqual([0, 1]);
  });

  it("preserves empty cells and row indexes across the used range", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Header", undefined, "Value"],
      [undefined, "Continuation", undefined]
    ]);

    const result = new XlsxWorkbookReader().read(workbookBinary({ Sheet1: sheet }));
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

  it("preserves merged cell ranges as metadata", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Program title", undefined, undefined],
      ["Goal", "Objective", "Action"]
    ]);
    sheet["!merges"] = [{ s: { c: 0, r: 0 }, e: { c: 2, r: 0 } }];

    const result = new XlsxWorkbookReader().read(workbookBinary({ Program: sheet }));

    expect(result.sheets[0].metadata.mergedCells).toEqual([{
      startColumn: "A",
      startRow: 0,
      endColumn: "C",
      endRow: 0
    }]);
    expect(result.sheets[0].rows[0].rawValues).toEqual(["Program title", undefined, undefined]);
  });

  it("preserves Persian headers and values", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["هدف", "مسئول اجرا"],
      ["بهبود کیفیت", "آقای رضایی"]
    ]);

    const result = new XlsxWorkbookReader().read(workbookBinary({ Persian: sheet }));
    const rows = result.sheets[0].rows;

    expect(rows[0].cells[0]).toMatchObject({
      rawValue: "هدف",
      normalizedValue: "هدف"
    });
    expect(rows[1].cells[1]).toMatchObject({
      rawValue: "آقای رضایی",
      normalizedValue: "آقای رضایی"
    });
  });
});
