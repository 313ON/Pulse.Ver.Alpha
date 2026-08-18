import { describe, expect, it } from "vitest";
import { kpiRecordToKPI, legacyStatusToProgramStatus, workItemToAction } from "./mappings";
import { createKpiMeasurement, createProgramDate, createProgress, normalizeProgramDigits } from "./primitives";
import { isActionOverdue, validateAction } from "./rules";

describe("canonical Program domain foundation", () => {
  it("maps every legacy status without changing its meaning", () => {
    expect(legacyStatusToProgramStatus("در حال اجرا")).toBe("در حال اجرا");
    expect(legacyStatusToProgramStatus("لغو شده")).toBe("لغو شده");
    expect(legacyStatusToProgramStatus("تأیید شده")).toBe("تأیید شده");
  });

  it("creates numeric KPI measurements and canonical KPIs", () => {
    expect(createKpiMeasurement(98.7, "٪")).toEqual({ value: 98.7, unit: "٪" });
    expect(kpiRecordToKPI({
      id: "kpi-1",
      name: "دسترس‌پذیری",
      actual: 98.7,
      target: 99.5,
      direction: "higher-is-better",
      unit: "٪"
    })).toMatchObject({ target: 99.5, actual: 98.7, unit: "٪", direction: "higher-is-better" });
    expect(() => createKpiMeasurement(Number.NaN, "٪")).toThrow();
  });

  it("enforces bounded progress", () => {
    expect(createProgress(0)).toBe(0);
    expect(createProgress(100)).toBe(100);
    expect(() => createProgress(-1)).toThrow();
    expect(() => createProgress(101)).toThrow();
    expect(() => createProgress(10.5)).toThrow();
  });

  it("normalizes Persian and Arabic Jalali dates without changing the calendar", () => {
    expect(normalizeProgramDigits("۱۴۰۵/۰۵/۲۶")).toBe("1405/05/26");
    expect(normalizeProgramDigits("١٤٠٥/٠٥/٢٦")).toBe("1405/05/26");
    expect(createProgramDate("۱۴۰۵/۰۵/۲۶")).toBe("1405/05/26");
  });

  it("maps and validates an Action using the canonical contract", () => {
    const action = workItemToAction({
      publicId: "G01-O01-A01-T001",
      goalId: "G01",
      title: "اقدام نمونه",
      workType: "اقدام",
      ownerPersonId: "person-1",
      departmentId: "department-1",
      deliverable: "خروجی نمونه",
      deadline: "۱۴۰۵/۰۵/۲۵",
      plannedStart: "۱۴۰۵/۰۵/۰۱",
      status: "در حال اجرا",
      progress: 40
    });
    expect(action.ownerRef).toEqual({ id: "person-1" });
    expect(action.department).toEqual({ id: "department-1" });
    expect(validateAction(action, new Set(["G01"]))).toEqual([]);
    expect(isActionOverdue(action, "۱۴۰۵/۰۵/۲۶")).toBe(true);
  });
});
