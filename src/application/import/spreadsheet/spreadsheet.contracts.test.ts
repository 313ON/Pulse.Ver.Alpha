import { describe, expect, it } from "vitest";
import {
  ColumnMappingResolver,
  normalizeSpreadsheetHeader,
  type ImportTemplateDefinition,
  type RowContract,
  type SheetContract
} from "./index";

const template: ImportTemplateDefinition = {
  name: "program-template",
  goalColumns: [{ key: "goalTitle", headers: ["Goal", "هدف"], required: true }],
  objectiveColumns: [{ key: "objectiveTitle", headers: ["Objective", "هدف عملیاتی"], required: true }],
  activityColumns: [{ key: "activityTitle", headers: ["Activity", "فعالیت"], required: true }],
  actionColumns: [{ key: "actionTitle", headers: ["Action", "اقدام"], required: true }],
  kpiColumns: [{ key: "kpiTitle", headers: ["KPI", "شاخص"], required: true }],
  assignmentColumns: [{ key: "responsible", headers: ["Responsible", "مسئول"], required: true }],
  dateColumns: [{ key: "startDate", headers: ["Start Date", "تاریخ شروع"], required: true }]
};

function sheet(headers: string[]): SheetContract {
  return {
    name: "Program",
    metadata: { headerRowIndex: 0 },
    rows: [{
      index: 0,
      cells: headers.map((rawValue, index) => ({
        column: String.fromCharCode(65 + index),
        rawValue,
        normalizedValue: normalizeSpreadsheetHeader(rawValue)
      })),
      rawValues: headers
    }]
  };
}

describe("Spreadsheet intelligence contracts", () => {
  it("resolves a valid template mapping across all supported groups", () => {
    const result = new ColumnMappingResolver(template).resolve(sheet([
      "Goal",
      "Objective",
      "Activity",
      "Action",
      "KPI",
      "Responsible",
      "Start Date"
    ]));

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "goalTitle", group: "goal", column: "A" }),
      expect.objectContaining({ key: "startDate", group: "date", column: "G" })
    ]));
  });

  it("detects missing required columns", () => {
    const result = new ColumnMappingResolver(template).resolve(["Goal", "Objective"]);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "MISSING_REQUIRED_COLUMN",
        key: "actionTitle",
        group: "action"
      }),
      expect.objectContaining({ code: "MISSING_REQUIRED_COLUMN", key: "startDate" })
    ]));
  });

  it("represents hierarchy rows and continuation rows without parsing spreadsheet files", () => {
    const hierarchyRow: RowContract = {
      index: 3,
      rowType: "hierarchy",
      cells: [{
        column: "A",
        rawValue: "Enterprise goal",
        normalizedValue: "enterprise goal"
      }],
      rawValues: ["Enterprise goal"],
      metadata: { hierarchyLevel: 0, repeatedHierarchy: true }
    };
    const continuationRow: RowContract = {
      index: 4,
      rowType: "continuation",
      cells: [],
      rawValues: [],
      metadata: { continuationOfRowIndex: 3 }
    };

    expect(hierarchyRow.metadata?.repeatedHierarchy).toBe(true);
    expect(continuationRow.metadata?.continuationOfRowIndex).toBe(3);
  });

  it("normalizes Persian header variants and Persian digits", () => {
    expect(normalizeSpreadsheetHeader("  کِی‌پی‌آی ۱۴۰۵  ")).toBe("کی پی ای ۱۴۰۵");
    expect(normalizeSpreadsheetHeader("مسئول‌ اجرا")).toBe("مسئول اجرا");

    const result = new ColumnMappingResolver({
      name: "persian-template",
      goalColumns: [{ key: "goalTitle", headers: ["هدف"], required: true }]
    }).resolve(["ﻫﺪﻑ"]);

    expect(result.valid).toBe(true);
    expect(result.mappings[0]).toMatchObject({ key: "goalTitle", column: "A" });
  });
});
