import { describe, expect, it } from "vitest";
import type { RowContract, WorkbookContract } from "../contracts";
import { HeaderSemanticResolver } from "./HeaderSemanticResolver";
import { SpreadsheetMappingEngine } from "./SpreadsheetMappingEngine";

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

function workbook(rows: RowContract[], mergedCells: NonNullable<WorkbookContract["sheets"][number]["metadata"]["mergedCells"]> = []): WorkbookContract {
  return {
    name: "semantic-import.xlsx",
    sheets: [{
      name: "Programs",
      rows,
      metadata: { headerRowIndex: 0, mergedCells }
    }]
  };
}

function workbookWithSheets(sheets: WorkbookContract["sheets"]): WorkbookContract {
  return {
    name: "semantic-import.xlsx",
    sheets
  };
}

describe("Spreadsheet semantic mapping", () => {
  it("maps Persian headers to deterministic semantic types", () => {
    const resolver = new HeaderSemanticResolver();

    expect(resolver.resolve("هدف کل")).toBe("GOAL");
    expect(resolver.resolve("هدف جزئی")).toBe("OBJECTIVE");
    expect(resolver.resolve("فعالیت")).toBe("ACTIVITY");
    expect(resolver.resolve("اقدام")).toBe("ACTION");
    expect(resolver.resolve("شاخص")).toBe("KPI");
    expect(resolver.resolve("مسئول")).toBe("EXECUTOR");
    expect(resolver.resolve("مجری")).toBe("EXECUTOR");
    expect(resolver.resolve("همکار")).toBe("COLLABORATOR");
  });

  it("maps English headers to deterministic semantic types", () => {
    const resolver = new HeaderSemanticResolver();

    expect(resolver.resolve("Goal")).toBe("GOAL");
    expect(resolver.resolve("Objective")).toBe("OBJECTIVE");
    expect(resolver.resolve("Activity")).toBe("ACTIVITY");
    expect(resolver.resolve("Action")).toBe("ACTION");
    expect(resolver.resolve("KPI")).toBe("KPI");
    expect(resolver.resolve("Owner")).toBe("OWNER");
    expect(resolver.resolve("Executor")).toBe("EXECUTOR");
    expect(resolver.resolve("Collaborator")).toBe("COLLABORATOR");
    expect(resolver.resolve("Start Date")).toBe("START_DATE");
    expect(resolver.resolve("Progress")).toBe("PROGRESS");
  });

  it("reconstructs hierarchy when parent rows are repeated", () => {
    const records = new SpreadsheetMappingEngine().map(workbook([
      row(0, ["Goal", "Activity", "Action"]),
      row(1, ["Goal 1", undefined, undefined]),
      row(2, ["Goal 1", "Activity 1", undefined]),
      row(3, [undefined, "Activity 2", "Action 2"])
    ]));

    expect(records.map((record) => record.entityType)).toEqual(["goal", "activity", "action"]);
    expect(records[1].data).toMatchObject({
      goal: "Goal 1",
      activity: "Activity 1"
    });
    expect(records[2].data).toMatchObject({
      goal: "Goal 1",
      activity: "Activity 2",
      action: "Action 2"
    });
  });

  it("inherits hierarchy values through empty continuation cells", () => {
    const records = new SpreadsheetMappingEngine().map(workbook([
      row(0, ["Goal", "Objective", "Activity", "Action"]),
      row(1, ["هدف اصلی", undefined, undefined, undefined], "hierarchy"),
      row(2, [undefined, "هدف جزئی", undefined, undefined], "continuation"),
      row(3, [undefined, undefined, "فعالیت", undefined], "continuation"),
      row(4, [undefined, undefined, undefined, "اقدام"], "continuation")
    ]));

    expect(records).toHaveLength(4);
    expect(records[3]).toMatchObject({
      entityType: "action",
      rowNumber: 4,
      data: {
        goal: "هدف اصلی",
        objective: "هدف جزئی",
        activity: "فعالیت",
        action: "اقدام"
      }
    });
  });

  it("preserves an objective whose merged range remains active when the goal changes", () => {
    const records = new SpreadsheetMappingEngine().map(workbook([
      row(0, ["Goal", "Objective", "Activity", "Action"]),
      row(1, ["Previous goal", undefined, undefined, undefined]),
      row(2, [undefined, undefined, undefined, undefined]),
      row(3, [undefined, undefined, undefined, undefined]),
      row(4, [undefined, "Active objective", undefined, undefined]),
      row(5, [undefined, undefined, undefined, undefined]),
      row(6, [undefined, undefined, undefined, undefined]),
      row(7, [undefined, undefined, undefined, undefined]),
      row(8, [undefined, undefined, undefined, undefined]),
      row(9, ["Current goal", undefined, "Current activity", "Action 1"])
    ], [
      { startColumn: "A", startRow: 1, endColumn: "A", endRow: 8 },
      { startColumn: "A", startRow: 9, endColumn: "A", endRow: 11 },
      { startColumn: "B", startRow: 4, endColumn: "B", endRow: 11 },
      { startColumn: "C", startRow: 9, endColumn: "C", endRow: 11 }
    ]));

    expect(records.find((record) => record.entityType === "action")?.data).toMatchObject({
      goal: "Current goal",
      objective: "Active objective",
      activity: "Current activity",
      action: "Action 1"
    });
  });

  it("preserves a merged descendant across every row covered by its own range", () => {
    const records = new SpreadsheetMappingEngine().map(workbook([
      row(0, ["Goal", "Objective", "Activity", "Action"]),
      row(1, [undefined, undefined, undefined, undefined]),
      row(2, [undefined, undefined, undefined, undefined]),
      row(3, [undefined, undefined, undefined, undefined]),
      row(4, [undefined, "Active objective", undefined, undefined]),
      row(5, [undefined, undefined, undefined, undefined]),
      row(6, [undefined, undefined, undefined, undefined]),
      row(7, [undefined, undefined, undefined, undefined]),
      row(8, [undefined, undefined, undefined, undefined]),
      row(9, ["Current goal", undefined, "Current activity", "Action 1"]),
      row(10, [undefined, undefined, undefined, "Action 2"]),
      row(11, [undefined, undefined, undefined, "Action 3"])
    ], [
      { startColumn: "A", startRow: 9, endColumn: "A", endRow: 11 },
      { startColumn: "B", startRow: 4, endColumn: "B", endRow: 11 },
      { startColumn: "C", startRow: 9, endColumn: "C", endRow: 11 }
    ]));

    expect(records.filter((record) => record.entityType === "action")).toHaveLength(3);
    expect(records.filter((record) => record.entityType === "action").map((record) => record.data.objective))
      .toEqual(["Active objective", "Active objective", "Active objective"]);
  });

  it("clears a descendant after its own merged range expires", () => {
    const records = new SpreadsheetMappingEngine().map(workbook([
      row(0, ["Goal", "Objective", "Activity", "Action"]),
      row(1, [undefined, "Expired objective", undefined, undefined]),
      row(2, [undefined, undefined, undefined, undefined]),
      row(3, [undefined, undefined, undefined, undefined]),
      row(4, [undefined, undefined, undefined, undefined]),
      row(5, ["Current goal", undefined, undefined, "Action after objective"])
    ], [
      { startColumn: "A", startRow: 1, endColumn: "A", endRow: 4 },
      { startColumn: "B", startRow: 1, endColumn: "B", endRow: 3 }
    ]));

    expect(records.find((record) => record.entityType === "action")?.data).toMatchObject({
      goal: "Current goal",
      action: "Action after objective"
    });
    expect(records.find((record) => record.entityType === "action")?.data.objective).toBeUndefined();
  });

  it("expires an inherited objective before an action-only row", () => {
    const records = new SpreadsheetMappingEngine().map(workbook([
      row(0, ["Goal", "Objective", "Activity", "Action"]),
      row(1, ["Goal 1", "Objective 1", "Activity 1", undefined]),
      row(2, [undefined, undefined, undefined, undefined]),
      row(3, [undefined, undefined, undefined, "Action after objective"])
    ], [
      { startColumn: "A", startRow: 1, endColumn: "A", endRow: 3 },
      { startColumn: "B", startRow: 1, endColumn: "B", endRow: 2 },
      { startColumn: "C", startRow: 1, endColumn: "C", endRow: 3 }
    ]));

    expect(records.find((record) => record.entityType === "action")?.data).toMatchObject({
      goal: "Goal 1",
      activity: "Activity 1",
      action: "Action after objective"
    });
    expect(records.find((record) => record.entityType === "action")?.data.objective).toBeUndefined();
  });

  it("expires an inherited activity when its merged range ends", () => {
    const records = new SpreadsheetMappingEngine().map(workbook([
      row(0, ["Goal", "Objective", "Activity", "Action"]),
      row(1, ["Goal 1", "Objective 1", "Activity 1", undefined]),
      row(2, [undefined, undefined, undefined, "Action 1"]),
      row(3, [undefined, undefined, undefined, "Action 2"])
    ], [
      { startColumn: "A", startRow: 1, endColumn: "A", endRow: 3 },
      { startColumn: "B", startRow: 1, endColumn: "B", endRow: 3 },
      { startColumn: "C", startRow: 1, endColumn: "C", endRow: 2 }
    ]));

    expect(records.find((record) => record.id === "Programs:2:action")?.data.activity).toBe("Activity 1");
    expect(records.find((record) => record.id === "Programs:3:action")?.data.activity).toBeUndefined();
  });

  it("does not carry hierarchy state across sheets", () => {
    const records = new SpreadsheetMappingEngine().map(workbookWithSheets([
      {
        name: "First",
        rows: [
          row(0, ["Goal", "Objective", "Activity", "Action"]),
          row(1, ["Goal 1", "Objective 1", undefined, undefined])
        ],
        metadata: { headerRowIndex: 0 }
      },
      {
        name: "Second",
        rows: [
          row(0, ["Goal", "Objective", "Activity", "Action"]),
          row(1, [undefined, undefined, undefined, "Action without parents"])
        ],
        metadata: { headerRowIndex: 0 }
      }
    ]));

    expect(records.find((record) => record.id === "Second:1:action")?.data).toEqual({
      action: "Action without parents"
    });
  });

  it("does not preserve an inherited value through a later unrelated merge in the same column", () => {
    const records = new SpreadsheetMappingEngine().map(workbook([
      row(0, ["Goal", "Objective", "Activity", "Action"]),
      row(1, ["Goal 1", "Objective 1", "Activity 1", undefined]),
      row(2, [undefined, undefined, undefined, undefined]),
      row(3, [undefined, "Objective 2", undefined, "Action 2"])
    ], [
      { startColumn: "A", startRow: 1, endColumn: "A", endRow: 3 },
      { startColumn: "B", startRow: 1, endColumn: "B", endRow: 3 },
      { startColumn: "C", startRow: 1, endColumn: "C", endRow: 2 },
      { startColumn: "C", startRow: 3, endColumn: "C", endRow: 4 }
    ]));

    expect(records.find((record) => record.entityType === "action")?.data).toMatchObject({
      goal: "Goal 1",
      objective: "Objective 2",
      action: "Action 2"
    });
    expect(records.find((record) => record.entityType === "action")?.data.activity).toBeUndefined();
  });

  it("maps assignment columns into normalized import data", () => {
    const records = new SpreadsheetMappingEngine().map(workbook([
      row(0, ["Action", "مسئول", "همکار", "واحد", "شخص"]),
      row(1, ["Launch", "مجری اصلی", "تیم کیفیت", "واحد مرکزی", "سارا"])
    ]));

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      entityType: "action",
      data: {
        action: "Launch",
        executor: "مجری اصلی",
        collaborator: "تیم کیفیت",
        unit: "واحد مرکزی",
        person: "سارا"
      }
    });
    expect(records[0].provenance).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sheetName: "Programs",
        sourceRowNumber: 2,
        column: "B",
        address: "B2",
        semanticType: "EXECUTOR",
        rawValue: "مجری اصلی"
      })
    ]));
  });
});
