import { describe, expect, it } from "vitest";
import { isGoalBriefComplete, validateGoalBrief } from "./goal-brief";
import { classifyDeadline } from "./deadlines";
import { daysInJalaliMonth, formatJalaliDate, parseJalaliDate, shiftJalaliMonth } from "./calendar";

describe("strategic intelligence rules", () => {
  it("keeps missing goal briefs incomplete and validates bounded text", () => {
    expect(isGoalBriefComplete({ brief: "", strategicRationale: "x", expectedOutcome: "x", scope: "x", successCriteria: "x" })).toBe(false);
    expect(validateGoalBrief({ brief: "x" })).toEqual([]);
    expect(validateGoalBrief({ brief: "x".repeat(2001) })).toHaveLength(1);
  });

  it("classifies action deadlines without using numeric Jalali subtraction", () => {
    expect(classifyDeadline({ plannedEnd: "1405/06/25", status: "در حال اجرا" }, "1405/06/26")).toBe("overdue");
    expect(classifyDeadline({ plannedEnd: "1405/07/05", status: "در حال اجرا" }, "1405/06/25")).toBe("due-soon");
    expect(classifyDeadline({ plannedEnd: undefined, status: "در حال اجرا" }, "1405/06/25")).toBe("missing");
  });

  it("supports Persian date parsing and month navigation", () => {
    expect(parseJalaliDate("۱۴۰۵/۰۱/۰۱")).toEqual([1405, 1, 1]);
    expect(formatJalaliDate(1405, 1, 1)).toBe("1405/01/01");
    expect(shiftJalaliMonth(1405, 12, 1)).toEqual({ year: 1406, month: 1 });
    expect(shiftJalaliMonth(1405, 1, -1)).toEqual({ year: 1404, month: 12 });
    expect(daysInJalaliMonth(1399, 12)).toBe(30);
    expect(daysInJalaliMonth(1400, 12)).toBe(29);
  });
});
