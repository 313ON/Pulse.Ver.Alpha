import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { closeDatabase } from "./db";
import { seedBaseline } from "./seed";
import { seedAuthFoundation } from "./auth";
import { buildReport } from "./reporting";
import { createPdfBuffer, createXlsxBuffer } from "./exporters";

beforeEach(() => {
  closeDatabase();
  process.env.PULSE_DB_PATH = `:memory:`;
  seedBaseline();
  seedAuthFoundation();
});

describe("live reporting and exports", () => {
  it("applies persisted filters and includes management summaries", () => {
    const report = buildReport({ goal: "G10" });
    expect(report.summary.totalGoals).toBe(10);
    expect(report.actions.every((action) => action.goal_id === "G10")).toBe(true);
    expect(report.departments.length).toBeGreaterThan(0);
    expect(report.goals.length).toBe(10);
    expect(report.monthlyTrend).toBeDefined();
  });
  it("creates a real XLSX workbook and PDF document", async () => {
    const report = buildReport({});
    const xlsx = createXlsxBuffer(report);
    const workbook = XLSX.read(xlsx, { type: "buffer" });
    expect(workbook.SheetNames).toContain("گزارش برنامه");
    const pdf = await createPdfBuffer(report);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
