import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ImportPage, ImportReview, importStatusLabel, isValidXlsxFile } from "./ImportPage";

Object.assign(globalThis, { React });
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn()
  }),
  usePathname: () => "/imports"
}));

describe("Import command center", () => {
  it("renders the RTL upload entry point and review language", () => {
    const markup = renderToStaticMarkup(<ImportPage />);

    expect(markup).toContain("وارد کردن برنامه");
    expect(markup).toContain("تحلیل فایل");
    expect(markup).toContain("فایل برنامه را اینجا رها کنید");
    expect(markup).toContain('accept=".xlsx');
  });

  it("accepts only non-empty XLSX files within the production upload limit", () => {
    expect(isValidXlsxFile({
      name: "برنامه IT.xlsx",
      size: 1024,
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    })).toBe(true);
    expect(isValidXlsxFile({ name: "plan.pdf", size: 1024, type: "application/pdf" })).toBe(false);
    expect(isValidXlsxFile({ name: "plan.xlsx", size: 0, type: "" })).toBe(false);
    expect(isValidXlsxFile({ name: "plan.xlsx", size: 6 * 1024 * 1024, type: "" })).toBe(false);
  });

  it("uses explicit review state terminology", () => {
    expect(importStatusLabel("REVIEW_REQUIRED")).toBe("در انتظار بازبینی");
    expect(importStatusLabel("FAILED")).toBe("ناموفق");
  });

  it("renders persisted review data and XLSX provenance without inventing identity", () => {
    const markup = renderToStaticMarkup(<ImportReview job={{
      id: "import-test",
      source: { type: "EXCEL", name: "برنامه IT.xlsx", metadata: { planYear: 1405 } },
      status: "REVIEW_REQUIRED",
      createdAt: "2026-08-21T10:00:00.000Z",
      records: [{
        id: "Program:4:action",
        entityType: "action",
        source: { type: "EXCEL", name: "برنامه IT.xlsx", metadata: { sheetName: "برنامه IT", sheetIndex: 0 } },
        rowNumber: 4,
        data: { action: "راه‌اندازی سامانه", unit: "فناوری اطلاعات", executor: "مجری اصلی" }
      }]
    }} />);

    expect(markup).toContain("در انتظار بازبینی");
    expect(markup).toContain("راه‌اندازی سامانه");
    expect(markup).toContain("فناوری اطلاعات");
    expect(markup).toContain("برگه: برنامه IT");
    expect(markup).toContain("Workbook → Sheet → Row");
    expect(markup).not.toContain("سمت / نقش");
    expect(markup).not.toContain("تخصص");
  });
});
