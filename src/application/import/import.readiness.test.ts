import { describe, expect, it } from "vitest";
import { programFixture } from "../../domain/program/program.fixture";
import { ImportReadinessService } from "./ImportReadinessService";
import { normalizeImportRecords, normalizeJalaliDate, normalizeImportText } from "./normalization";
import type { ImportRecord, ImportSource } from "./contracts";

const source: ImportSource = {
  type: "MANUAL",
  name: "readiness-test",
  metadata: { test: true }
};

function record(id: string, data: Record<string, unknown>): ImportRecord {
  return { id, externalId: id, entityType: "action", source, data };
}

describe("Import readiness foundation", () => {
  it("normalizes Persian, Arabic, and English digits and whitespace", () => {
    expect(normalizeImportText("  اقدام  ۱۴۰۵/۰۱/۰۲  ")).toBe("اقدام 1405/01/02");
    expect(normalizeImportText("١٤٠٥/٠١/٠٢")).toBe("1405/01/02");
    expect(normalizeImportText("2026/01/02")).toBe("2026/01/02");
  });

  it("normalizes valid Jalali dates and rejects invalid dates", () => {
    expect(normalizeJalaliDate("۱۴۰۵-۱-۲")).toEqual({ valid: true, value: "1405/01/02" });
    expect(normalizeJalaliDate("۱۴۰۵/۱۳/۰۱").valid).toBe(false);
    expect(normalizeJalaliDate("not-a-date")).toMatchObject({ valid: false });

    const result = normalizeImportRecords([
      record("action-1", { plannedEnd: "۱۴۰۵/۱۳/۰۱" })
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "INVALID_DATE", field: "plannedEnd" })
    ]));
  });

  it("detects duplicate records and supports duplicate hooks", () => {
    const result = normalizeImportRecords([
      record("action-1", { title: "اول" }),
      record("action-1", { title: "تکراری" }),
      record("action-2", { title: "کلید خارجی تکراری" })
    ], {
      isDuplicate: (item) => item.id === "action-2"
    });

    expect(result.valid).toBe(false);
    expect(result.errors.filter((error) => error.code === "DUPLICATE_RECORD")).toHaveLength(2);
  });

  it("detects missing responsibility through the import readiness evaluation", () => {
    const evaluation = new ImportReadinessService().evaluateProgram(programFixture, { today: "۱۴۰۵/۰۱/۰۱" });

    expect(evaluation.assessment).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ACTIVITY_WITHOUT_RESPONSIBLE_EXECUTOR" })
    ]));
    expect(evaluation.governance.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: "assignment.primaryResponsible.required" })
    ]));
    expect(evaluation.qualityScore.dimensions.responsibility).toBeLessThan(100);
  });
});
