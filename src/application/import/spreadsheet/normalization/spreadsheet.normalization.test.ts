import { describe, expect, it } from "vitest";
import type { RowContract, WorkbookContract } from "../contracts";
import { SpreadsheetMappingEngine } from "../mapping";
import { SpreadsheetNormalizationEngine } from "./SpreadsheetNormalizationEngine";

function row(index: number, values: Array<unknown>, rowType?: RowContract["rowType"]): RowContract {
  return {
    index,
    rowType,
    cells: values.map((rawValue, columnIndex) => ({
      column: String.fromCharCode(65 + columnIndex),
      rawValue: rawValue as never,
      normalizedValue: String(rawValue ?? "")
    })),
    rawValues: values as never[]
  };
}

function source(rows: RowContract[]): WorkbookContract {
  return {
    name: "normalization.xlsx",
    sheets: [{ name: "Programs", rows, metadata: { headerRowIndex: 0, sheetIndex: 0 } }]
  };
}

describe("Spreadsheet semantic normalization", () => {
  it("normalizes Persian/Arabic characters and repeated whitespace", () => {
    const workbook = source([
      row(0, ["Action", "واحد"]),
      row(1, ["  ي ك  فناوری   اطلاعات  ", "  واحد فناوری اطلاعات  "])
    ]);
    const result = new SpreadsheetNormalizationEngine().normalize(workbook, new SpreadsheetMappingEngine().map(workbook));
    expect(result.records[0].data.action).toMatchObject({
      rawValue: "  ي ك  فناوری   اطلاعات  ",
      normalizedValue: "ی ک فناوری اطلاعات",
      status: "NORMALIZED"
    });
    expect(result.records[0].data.unit).toMatchObject({
      normalizedValue: "واحد فناوری اطلاعات",
      identityType: "UNIT"
    });
  });

  it("normalizes valid dates, preserves invalid dates, and never invents absent dates", () => {
    const workbook = source([
      row(0, ["Action", "تاریخ شروع", "تاریخ پایان"]),
      row(1, ["X", "۱۴۰۲/۱/۲", "۱۴۰۲/۱۳/۴"])
    ]);
    const result = new SpreadsheetNormalizationEngine().normalize(workbook, new SpreadsheetMappingEngine().map(workbook));
    expect(result.records[0].data.startDate).toMatchObject({ normalizedValue: "1402/01/02", status: "NORMALIZED" });
    expect(result.records[0].data.endDate).toMatchObject({ normalizedValue: "۱۴۰۲/۱۳/۴", status: "INVALID" });
    expect(result.records[0].data).not.toHaveProperty("duration");
  });

  it("normalizes explicit KPI fields and action aliases without generating values", () => {
    const workbook = source([
      row(0, ["اقدامات", "شاخص", "هدف شاخص", "مقدار شاخص", "واحد شاخص"]),
      row(1, ["X", "رضایت مشتری", " ۱۰۰ ", " ۸۰ ", " درصد "])
    ]);
    const records = new SpreadsheetMappingEngine().map(workbook);
    const result = new SpreadsheetNormalizationEngine().normalize(workbook, records);
    expect(result.records[0].data).toMatchObject({
      action: { normalizedValue: "X" },
      kpi: { normalizedValue: "رضایت مشتری" },
      kpiTarget: { normalizedValue: "100" },
      kpiValue: { normalizedValue: "80" },
      kpiUnit: { normalizedValue: "درصد" }
    });
  });

  it("marks unknown executor identity as UNKNOWN and preserves complete provenance", () => {
    const workbook = source([
      row(0, ["Action", "Executor", "Person"]),
      row(1, ["X", "  تیم ناشناخته  ", "سارا"])
    ]);
    const result = new SpreadsheetNormalizationEngine().normalize(workbook, new SpreadsheetMappingEngine().map(workbook));
    expect(result.records[0].data.executor).toMatchObject({
      normalizedValue: "تیم ناشناخته",
      identityType: "UNKNOWN"
    });
    expect(result.records[0].data.person).toMatchObject({ identityType: "PERSON" });
    expect(result.records[0].data.executor.provenance).toEqual({
      workbook: "normalization.xlsx",
      sheet: "Programs",
      row: 1,
      column: "B",
      cell: "B2",
      sheetIndex: 0,
      sourceRowNumber: 2
    });
  });

  it("produces byte-for-byte equivalent JSON for the same input", () => {
    const workbook = source([row(0, ["Action"]), row(1, ["  X  "])]);
    const engine = new SpreadsheetNormalizationEngine();
    const records = new SpreadsheetMappingEngine().map(workbook);
    expect(JSON.stringify(engine.normalize(workbook, records))).toBe(JSON.stringify(engine.normalize(workbook, records)));
  });
});
