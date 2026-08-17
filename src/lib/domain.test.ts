import { describe, expect, it } from "vitest";
import {
  calculatePulseScore,
  compareJalaliDates,
  getKpiHealth,
  inspectProgramQuality,
  isOverdue,
  parseJalaliDate,
  riskSeverity,
  validateWorkItem
} from "./domain";

const baseItem = {
  publicId: "G01-O01-A01-T001",
  goalId: "G01",
  title: "اقدام نمونه",
  workType: "اقدام" as const,
  ownerPersonId: "person-1",
  deliverable: "خروجی نمونه",
  deadline: "۱۴۰۵/۰۵/۲۵",
  status: "در حال اجرا" as const,
  progress: 40
};

describe("PULSE domain rules", () => {
  it("parses and compares Jalali dates without Gregorian conversion", () => {
    expect(parseJalaliDate("۱۴۰۵/۰۵/۲۶")).toEqual([1405, 5, 26]);
    expect(compareJalaliDates("۱۴۰۵/۰۵/۲۵", "۱۴۰۵/۰۵/۲۶")).toBe(-1);
    expect(isOverdue("۱۴۰۵/۰۵/۲۵", "۱۴۰۵/۰۵/۲۶", "در حال اجرا")).toBe(true);
    expect(isOverdue("۱۴۰۵/۰۵/۲۵", "۱۴۰۵/۰۵/۲۶", "تکمیل شده")).toBe(false);
  });

  it("validates required action fields and progress", () => {
    expect(validateWorkItem(baseItem, new Set(["G01"]))).toEqual([]);
    expect(validateWorkItem({ ...baseItem, ownerPersonId: undefined, progress: 101 }, new Set(["G01"]))).toEqual([
      "مسئول اقدام الزامی است.",
      "پیشرفت باید عدد صحیح بین ۰ تا ۱۰۰ باشد."
    ]);
  });

  it("calculates KPI health and risk severity", () => {
    expect(getKpiHealth({ id: "k1", name: "تولید", actual: 90, target: 90, direction: "higher-is-better" })).toBe("سبز");
    expect(getKpiHealth({ id: "k2", name: "تولید", actual: 70, target: 90, direction: "higher-is-better" })).toBe("قرمز");
    expect(getKpiHealth({ id: "k3", name: "پرت", actual: 0, target: 10, direction: "lower-is-better" })).toBe("سبز");
    expect(riskSeverity(4, 5)).toBe(20);
  });

  it("reports quality gaps, duplicate work and unresolved dependencies", () => {
    const result = inspectProgramQuality(
      [baseItem, { ...baseItem, publicId: "G01-O01-A01-T002" }, { ...baseItem, goalId: undefined, ownerPersonId: undefined, deliverable: undefined, deadline: undefined }],
      new Set(["G01", "G02"]),
      new Set(["G01-O01-A01-T001"]),
      [{ sourceWorkItemId: baseItem.publicId, targetWorkItemId: "G02-O01-A01-T001", status: "باز", delayDays: 2 }],
      "۱۴۰۵/۰۵/۲۶"
    );
    expect(result.duplicateActions).toBe(1);
    expect(result.actionWithoutGoal).toBe(1);
    expect(result.goalWithoutAction).toBe(1);
    expect(result.missingOwner).toBe(1);
    expect(result.missingDeliverable).toBe(1);
    expect(result.missingDeadline).toBe(1);
    expect(result.unresolvedDependencies).toBe(1);
    expect(result.overdue).toBe(2);
  });

  it("produces a bounded, traceable Pulse Score", () => {
    const result = calculatePulseScore(
      [80, 60],
      [baseItem, { ...baseItem, status: "تکمیل شده", progress: 100, deadline: "۱۴۰۵/۰۵/۲۰" }],
      [{ id: "k1", name: "تولید", actual: 90, target: 100, direction: "higher-is-better" }],
      [{ id: "r1", title: "ریسک", probability: 2, impact: 2, status: "باز" }],
      "۱۴۰۵/۰۵/۲۶"
    );
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
    expect(result.goalProgress).toBe(70);
    expect(result.executionControl).toBe(50);
  });
});
