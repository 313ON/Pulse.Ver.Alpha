import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ImportPage, ImportReview, importStatusLabel, isValidXlsxFile } from "./ImportPage";
import { canRetryMaterialization, materializationErrorMessage, materializationStatusLabel } from "./MaterializationControl";

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
  it("uses explicit materialization state and retry rules", () => {
    expect(materializationStatusLabel("COMPLETED")).toBe("تکمیل شده");
    expect(canRetryMaterialization({ status: "FAILED" })).toBe(true);
    expect(canRetryMaterialization({ status: "COMPLETED" })).toBe(false);
    expect(canRetryMaterialization(undefined)).toBe(false);
    expect(materializationErrorMessage("IMPORT_NOT_APPROVED", "fallback")).toContain("تأیید");
    expect(materializationErrorMessage("SNAPSHOT_MISMATCH", "fallback")).toContain("قدیمی");
    expect(materializationErrorMessage("UNKNOWN", "fallback")).toBe("fallback");
  });
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

  it("renders persisted hierarchy findings separately from governance findings", () => {
    const markup = renderToStaticMarkup(<ImportReview job={{
      id: "import-findings",
      source: { type: "EXCEL", name: "برنامه IT.xlsx", metadata: { planYear: 1405 } },
      status: "REVIEW_REQUIRED",
      createdAt: "2026-08-21T10:00:00.000Z",
      records: [{
        id: "Sheet1:9:action",
        entityType: "action",
        source: { type: "EXCEL", name: "برنامه IT.xlsx", metadata: { sheetName: "Sheet1", sheetIndex: 0 } },
        rowNumber: 9,
        data: {
          goal: "هدف کلان",
          objective: "هدف جزئی",
          action: "اقدام بدون فعالیت"
        },
        provenance: [{
          workbookName: "برنامه IT.xlsx",
          sheetName: "Sheet1",
          sheetIndex: 0,
          headerRowIndex: 0,
          rowIndex: 8,
          sourceRowNumber: 9,
          column: "D",
          address: "D9",
          semanticType: "OBJECTIVE",
          rawValue: "هدف جزئی"
        }, {
          workbookName: "برنامه IT.xlsx",
          sheetName: "Sheet1",
          sheetIndex: 0,
          headerRowIndex: 0,
          rowIndex: 8,
          sourceRowNumber: 9,
          column: "F",
          address: "F9",
          semanticType: "ACTION",
          rawValue: "اقدام بدون فعالیت"
        }]
      }],
      evaluationResult: {
        workbook: { workbookName: "برنامه IT.xlsx", sourceType: "EXCEL", sheetCount: 1 },
        sheets: [{
          provenance: { workbookName: "برنامه IT.xlsx", sheetName: "Sheet1", sheetIndex: 0, headerRowIndex: 0 },
          unknownHeaders: [],
          ambiguousHeaders: [],
          checks: [],
          rows: [{
            provenance: {
              workbookName: "برنامه IT.xlsx",
              sheetName: "Sheet1",
              sheetIndex: 0,
              headerRowIndex: 0,
              rowIndex: 8,
              sourceRowNumber: 9
            },
            recordId: "Sheet1:9:action",
            entityType: "action",
            status: "FAIL",
            cells: [],
            issues: [{
              category: "INHERITANCE_FAILURE",
              message: "Missing inherited activity.",
              recordId: "Sheet1:9:action",
              provenance: {
                workbookName: "IT.xlsx",
                sheetName: "Sheet1",
                sheetIndex: 0,
                headerRowIndex: 0,
                rowIndex: 8,
                sourceRowNumber: 9
              }
            }]
          }]
        }],
        summary: {
          totalSheets: 1,
          totalRows: 9,
          mappedRecords: 1,
          passedChecks: 0,
          failedChecks: 1,
          unknownHeaders: 0,
          ambiguousHeaders: 0,
          issueCounts: {
            UNKNOWN_HEADER: 0,
            AMBIGUOUS_HEADER: 0,
            MISSING_VALUE: 0,
            INVALID_HIERARCHY: 0,
            INHERITANCE_FAILURE: 1,
            UNRESOLVED_ASSIGNMENT: 0,
            UNSUPPORTED_STRUCTURE: 0,
            SOURCE_TRACE_FAILURE: 0
          },
          scorePercent: 80,
          status: "FAIL"
        }
      },
      qualityScore: {
        overallScore: 80,
        dimensions: { hierarchy: 100, responsibility: 100, kpi: 100, timeline: 100, governance: 0 },
        findings: [{ dimension: "governance", code: "goal.owner.required", severity: "error", message: "Goal owner is required.", entityId: "G01" }]
      }
    }} />);

    expect(markup).toContain("یافته‌های سلسله‌مراتبی");
    expect(markup).toContain("فعالیت مفقود است");
    expect(markup).toContain("هدف جزئی → اقدام");
    expect(markup).toContain("هدف جزئی → فعالیت → اقدام");
    expect(markup).toContain("ردیف منبع: 9");
    expect(markup).toContain("هشدارها و یافته‌های حاکمیتی");
    expect(markup).toContain("Goal owner is required.");
  });

  it("renders sheet-level evaluation findings with workbook and sheet context", () => {
    const markup = renderToStaticMarkup(<ImportReview job={{
      id: "import-sheet-findings",
      source: { type: "EXCEL", name: "source.xlsx", metadata: { planYear: 1405 } },
      status: "REVIEW_REQUIRED",
      createdAt: "2026-08-21T10:00:00.000Z",
      records: [],
      evaluationResult: {
        workbook: { workbookName: "source.xlsx", sourceType: "EXCEL", sheetCount: 1 },
        sheets: [{
          provenance: { workbookName: "source.xlsx", sheetName: "Plan", sheetIndex: 0, headerRowIndex: 2 },
          checks: [{
            name: "header-detection",
            status: "FAIL",
            issues: [{
              category: "UNKNOWN_HEADER",
              message: "Unknown header \"Untrusted <header>\".",
              provenance: {
                workbookName: "source.xlsx",
                sheetName: "Plan",
                sheetIndex: 0,
                headerRowIndex: 2
              }
            }]
          }],
          rows: [],
          unknownHeaders: ["Untrusted <header>"],
          ambiguousHeaders: []
        }],
        summary: {
          totalSheets: 1,
          totalRows: 3,
          mappedRecords: 0,
          passedChecks: 0,
          failedChecks: 1,
          unknownHeaders: 1,
          ambiguousHeaders: 0,
          issueCounts: {
            UNKNOWN_HEADER: 1,
            AMBIGUOUS_HEADER: 0,
            MISSING_VALUE: 0,
            INVALID_HIERARCHY: 0,
            INHERITANCE_FAILURE: 0,
            UNRESOLVED_ASSIGNMENT: 0,
            UNSUPPORTED_STRUCTURE: 0,
            SOURCE_TRACE_FAILURE: 0
          },
          scorePercent: 0,
          status: "FAIL"
        }
      }
    }} />);

    expect(markup).toContain("یافته‌های سطح برگه");
    expect(markup).toContain("source.xlsx · Plan");
    expect(markup).toContain("سربرگ ناشناخته");
    expect(markup).toContain("Unknown header");
    expect(markup).toContain("Untrusted &lt;header&gt;");
  });

  it("does not expose goal owner remediation", () => {
    const markup = renderToStaticMarkup(<ImportReview
      job={{
        id: "import-remediation",
        source: { type: "EXCEL", name: "source.xlsx", metadata: { planYear: 1405 } },
        status: "REVIEW_REQUIRED",
        analysisRevision: 1,
        createdAt: "2026-08-21T10:00:00.000Z",
        records: [{
          id: "goal-row",
          entityType: "goal",
          source: { type: "EXCEL", name: "source.xlsx", metadata: { sheetName: "Plan", sheetIndex: 0 } },
          rowNumber: 12,
          data: { goal: "G01", title: "هدف اول" },
          provenance: [{
            workbookName: "source.xlsx",
            sheetName: "Plan",
            sheetIndex: 0,
            rowIndex: 11,
            sourceRowNumber: 12,
            column: "A",
            address: "A12",
            rawValue: "G01",
            semanticType: "GOAL"
          }]
        }],
        assessmentResult: {
          governance: {
            errors: [{
              rule: "goal.owner.required",
              entityId: "G01",
              message: "Goal owner is required."
            }]
          }
        }
      }}
      people={[{ id: "person-1", full_name: "Person One" }]}
      onRemediateGoalOwner={() => undefined}
    />);

    expect(markup).not.toContain("یافته‌های حاکمیتی");
    expect(markup).not.toContain("مالک هدف الزامی است");
  });
});
