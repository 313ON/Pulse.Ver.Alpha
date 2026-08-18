import { describe, expect, it } from "vitest";
import { createProgress } from "../primitives";
import type { Assignment } from "../Assignment";
import { ProgramGovernanceRules } from "./ProgramGovernanceRules";
import { assessProgramResponsibilities } from "./ResponsibilityAssessment";

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

  it("requires a primary responsible assignment for critical work", () => {
    const report = rules.validateActivity({
      id: "activity-1",
      type: "activity",
      title: "فعالیت بحرانی",
      status: "در حال اجرا",
      priority: "بحرانی",
      objectiveId: "objective-1",
      assignments: []
    });

    expect(report.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: "assignment.primaryResponsible.required" })
    ]));
  });

  it("rejects duplicate and unknown assignment references", () => {
    const assignment: Assignment = {
      id: "assignment-1",
      entityType: "PERSON",
      entityId: "person-unknown",
      displayName: "کارشناس",
      role: "EXECUTOR",
      responsibilityType: "PRIMARY"
    };
    const report = rules.validateAction({
      id: "action-1",
      type: "action",
      title: "اقدام",
      status: "در حال اجرا",
      activityId: "activity-1",
      owner: "کارشناس",
      deadline: "۱۴۰۵/۰۳/۰۱",
      assignments: [assignment, { ...assignment, id: "assignment-2" }]
    }, { validPersonIds: new Set(["person-valid"]) });

    expect(report.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: "assignment.duplicate" }),
      expect.objectContaining({ rule: "assignment.reference.valid" })
    ]));
  });

  it("reports responsibility workload and collaboration risks", () => {
    const program = {
      id: "program-1",
      type: "program" as const,
      title: "برنامه",
      description: "",
      status: "در حال اجرا" as const,
      owner: "مدیر",
      priority: "زیاد" as const,
      timeline: { start: "", end: "" },
      progress: createProgress(0),
      goals: [{
        id: "goal-1",
        type: "goal" as const,
        programId: "program-1",
        title: "هدف",
        description: "",
        status: "در حال اجرا" as const,
        owner: "مدیر",
        priority: "زیاد" as const,
        timeline: { start: "", end: "" },
        progress: createProgress(0),
        objectives: [{
          id: "objective-1",
          type: "objective" as const,
          goalId: "goal-1",
          title: "هدف جزئی",
          description: "",
          status: "در حال اجرا" as const,
          owner: "مدیر",
          priority: "زیاد" as const,
          timeline: { start: "", end: "" },
          progress: createProgress(0),
          activities: [{
            id: "activity-1",
            type: "activity" as const,
            objectiveId: "objective-1",
            title: "فعالیت",
            description: "",
            status: "در حال اجرا" as const,
            owner: "مدیر",
            priority: "بحرانی" as const,
            timeline: { start: "", end: "" },
            progress: createProgress(0),
            assignments: [{
              id: "assignment-1",
              entityType: "PERSON" as const,
              entityId: "person-1",
              displayName: "مهندس",
              role: "EXECUTOR" as const,
              responsibilityType: "PRIMARY" as const
            }, {
              id: "assignment-2",
              entityType: "UNIT" as const,
              entityId: "unit-1",
              displayName: "واحد فنی",
              role: "EXECUTOR" as const,
              responsibilityType: "SUPPORT" as const
            }],
            actions: []
          }]
        }]
      }]
    };
    const findings = assessProgramResponsibilities(program, {
      individualAssignmentThreshold: 0,
      unitAssignmentThreshold: 0,
      requireCriticalCollaboration: true
    });

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MISSING_COLLABORATION_COVERAGE" }),
      expect.objectContaining({ code: "OVER_DEPENDENT_INDIVIDUAL" }),
      expect.objectContaining({ code: "OVERLOADED_UNIT" })
    ]));
  });
});
