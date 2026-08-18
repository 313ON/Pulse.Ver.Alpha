import { describe, expect, it } from "vitest";
import type { RowContract, WorkbookContract } from "../contracts";
import { SpreadsheetMappingEngine } from "../mapping";
import {
  EVALUATION_FAILURE_CATEGORIES,
  SpreadsheetEvaluationEngine
} from "./index";

function row(index: number, values: Array<string | undefined>, rowType?: RowContract["rowType"]): RowContract {
  return {
    index,
    rowType,
    cells: values.map((rawValue, columnIndex) => ({
      column: String.fromCharCode(65 + columnIndex),
      rawValue,
      normalizedValue: rawValue ?? ""
    })),
    rawValues: values
  };
}

function workbook(rows: RowContract[], name = "golden-fixture.xlsx"): WorkbookContract {
  return {
    name,
    sheets: [{
      name: "Programs",
      rows,
      metadata: { headerRowIndex: 0, sheetIndex: 0 }
    }]
  };
}

describe("Spreadsheet evaluation", () => {
  it("evaluates Persian, English, and mixed headers with provenance", () => {
    const source = workbook([
      row(0, ["هدف", "Objective", "فعالیت", "Action", "مسئول اجرا", "همکار", "واحد", "تاریخ شروع"]),
      row(1, ["بهبود کیفیت", "Improve service", "پایش", "Launch review", "سارا", "تیم کیفیت", "واحد مرکزی", undefined]),
      row(2, [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined], "empty")
    ]);
    const records = new SpreadsheetMappingEngine().map(source);
    const report = new SpreadsheetEvaluationEngine().evaluate(source, records);

    expect(report.summary.status).toBe("PASS");
    expect(report.summary.unknownHeaders).toBe(0);
    expect(report.summary.ambiguousHeaders).toBe(0);
    expect(report.sheets[0].rows[0].cells[0]).toMatchObject({
      address: "A2",
      header: "هدف",
      semanticType: "GOAL",
      rawValue: "بهبود کیفیت"
    });
    expect(report.sheets[0].checks.map((check) => check.status)).toEqual(["PASS", "PASS", "PASS", "PASS", "PASS"]);
  });

  it("supports hierarchy inheritance and empty continuation rows", () => {
    const source = workbook([
      row(0, ["Goal", "Objective", "Activity", "Action"]),
      row(1, ["G1", undefined, undefined, undefined], "hierarchy"),
      row(2, [undefined, "O1", undefined, undefined], "continuation"),
      row(3, [undefined, undefined, "A1", undefined], "continuation"),
      row(4, [undefined, undefined, undefined, "X1"], "continuation"),
      row(5, [undefined, undefined, undefined, undefined], "empty")
    ]);
    const report = new SpreadsheetEvaluationEngine().evaluate(source, new SpreadsheetMappingEngine().map(source));

    expect(report.summary.status).toBe("PASS");
    expect(report.summary.mappedRecords).toBe(4);
    expect(report.sheets[0].rows).toHaveLength(4);
  });

  it("does not fail when optional assignment and temporal fields are absent", () => {
    const source = workbook([
      row(0, ["Goal", "Objective", "Activity", "Action", "Executor", "Start Date", "End Date"]),
      row(1, ["G1", "O1", "A1", "X1", undefined, undefined, undefined])
    ]);
    const report = new SpreadsheetEvaluationEngine().evaluate(source, new SpreadsheetMappingEngine().map(source));

    expect(report.summary.status).toBe("PASS");
    expect(report.summary.issueCounts.MISSING_VALUE).toBe(0);
    expect(report.summary.issueCounts.UNRESOLVED_ASSIGNMENT).toBe(0);
  });

  it("reports unknown and ambiguous headers deterministically", () => {
    const source = workbook([
      row(0, ["Goal", "Action", "Action", "Notes"]),
      row(1, ["G1", "X1", "X1 duplicate", "free text"])
    ]);
    const report = new SpreadsheetEvaluationEngine().evaluate(source, new SpreadsheetMappingEngine().map(source));

    expect(report.summary.status).toBe("FAIL");
    expect(report.sheets[0].unknownHeaders).toEqual(["Notes"]);
    expect(report.sheets[0].ambiguousHeaders).toEqual(["Action"]);
    expect(report.summary.issueCounts.UNKNOWN_HEADER).toBe(1);
    expect(report.summary.issueCounts.AMBIGUOUS_HEADER).toBe(1);
  });

  it("reports an inheritance failure when a child has no parent", () => {
    const source = workbook([
      row(0, ["Goal", "Action"]),
      row(1, [undefined, "X1"])
    ]);
    const report = new SpreadsheetEvaluationEngine().evaluate(source, new SpreadsheetMappingEngine().map(source));

    expect(report.summary.status).toBe("FAIL");
    expect(report.summary.issueCounts.INHERITANCE_FAILURE).toBe(3);
    expect(report.sheets[0].checks.find((check) => check.name === "hierarchy")?.status).toBe("FAIL");
  });

  it("exposes the complete failure taxonomy", () => {
    expect(EVALUATION_FAILURE_CATEGORIES).toEqual([
      "UNKNOWN_HEADER",
      "AMBIGUOUS_HEADER",
      "MISSING_VALUE",
      "INVALID_HIERARCHY",
      "INHERITANCE_FAILURE",
      "UNRESOLVED_ASSIGNMENT",
      "UNSUPPORTED_STRUCTURE",
      "SOURCE_TRACE_FAILURE"
    ]);
  });
});
