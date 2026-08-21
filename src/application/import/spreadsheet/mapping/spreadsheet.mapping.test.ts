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

function workbook(rows: RowContract[]): WorkbookContract {
  return {
    name: "semantic-import.xlsx",
    sheets: [{
      name: "Programs",
      rows,
      metadata: { headerRowIndex: 0 }
    }]
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
