import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { XlsxWorkbookReader } from "../xlsx";
import { SpreadsheetMappingEngine } from "../mapping";
import { discoverMasterPlan } from "./MasterPlanSemantics";

describe("Master Plan semantics", () => {
  it("maps the real 14-column unit sheets to actions and preserves RACI", async () => {
    const name = "برنامه عملیاتی سال ۱۴۰۵ - Master Plan (Unit-Based)-V1.1.xlsx";
    const workbook = await new XlsxWorkbookReader().read(await fs.readFile(path.join(process.cwd(), "Samples", name)), { name });
    const records = new SpreadsheetMappingEngine({ sourceName: name }).map(workbook);
    const discovery = discoverMasterPlan(records);
    expect(discovery.actions).toHaveLength(1649);
    expect(discovery.goals).toHaveLength(10);
    expect(records[0].data).toMatchObject({ sourceCode: "IT-0001", responsible: "فناوری اطلاعات", accountable: "مدیریت پالایشگاه" });
    expect(records[0].data.assignments).toEqual(expect.arrayContaining([
      expect.objectContaining({ raciType: "R", displayName: "فناوری اطلاعات" }),
      expect.objectContaining({ raciType: "A", displayName: "مدیریت پالایشگاه" }),
      expect.objectContaining({ raciType: "I", displayName: "مدیرعامل" }),
      expect.objectContaining({ raciType: "I", displayName: "واحدهای درخواست کننده" })
    ]));
  });

  it("normalizes numbered and Persian text variants without fuzzy merging", () => {
    const records = [
      { id: "a", entityType: "goal" as const, source: { type: "MANUAL" as const, name: "x", metadata: {} }, data: { goal: "6- افزایش بهره‌وری از امکانات و تجهیزات" } },
      { id: "b", entityType: "goal" as const, source: { type: "MANUAL" as const, name: "x", metadata: {} }, data: { goal: "افزایش بهره وری از امکانات و تجهیزات" } }
    ];
    expect(discoverMasterPlan(records).goals).toHaveLength(1);
  });
});
