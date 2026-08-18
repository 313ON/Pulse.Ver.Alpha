import { describe, expect, it } from "vitest";
import { ProgramGovernanceRules } from "./ProgramGovernanceRules";

const rules = new ProgramGovernanceRules();

describe("ProgramGovernanceRules", () => {
  it("reports invalid hierarchy relationships", () => {
    const report = rules.validateObjective({
      id: "objective-1",
      type: "objective",
      title: "افزایش بهره‌وری",
      status: "پیش‌نویس"
    });

    expect(report.valid).toBe(false);
    expect(report.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: "objective.parentGoal.required", severity: "error" })
    ]));
  });

  it("reports missing goal and action owners", () => {
    const goalReport = rules.validateGoal({
      id: "goal-1",
      type: "goal",
      title: "هدف",
      status: "پیش‌نویس"
    });
    const actionReport = rules.validateAction({
      id: "action-1",
      type: "action",
      title: "اقدام",
      status: "شروع نشده",
      activityId: "activity-1",
      deadline: "۱۴۰۵/۰۳/۰۱"
    });

    expect(goalReport.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: "goal.owner.required" })
    ]));
    expect(actionReport.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: "action.owner.required" })
    ]));
  });

  it("reports a missing or non-numeric KPI target", () => {
    const report = rules.validateKPI({
      id: "kpi-1",
      type: "kpi",
      title: "دسترس‌پذیری",
      status: "در حال اجرا",
      unit: "٪",
      direction: "higher-is-better"
    });

    expect(report.valid).toBe(false);
    expect(report.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: "kpi.target.numeric" })
    ]));
  });

  it("supports multiple violations and warning severity", () => {
    const report = rules.validateKPI({
      id: "kpi-1",
      type: "kpi",
      title: "",
      status: "در حال اجرا",
      target: "not-a-number",
      direction: "unknown"
    });

    expect(report.violations.length).toBeGreaterThan(1);
    expect(report.warnings).toHaveLength(0);
    expect(report.errors.length).toBe(report.violations.length);
  });

  it("rejects transitions out of terminal statuses", () => {
    const report = rules.validateStatusTransition(
      { id: "action-1", type: "action" },
      "تکمیل شده",
      "در حال اجرا"
    );

    expect(report.valid).toBe(false);
    expect(report.errors[0]).toMatchObject({
      rule: "status.transition.valid",
      entityId: "action-1"
    });
  });
});
