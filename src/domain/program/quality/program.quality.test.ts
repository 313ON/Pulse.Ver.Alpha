import { describe, expect, it } from "vitest";
import { createGovernanceReport } from "../governance/GovernanceViolation";
import { assessProgramResponsibilities } from "../governance/ResponsibilityAssessment";
import { programFixture } from "../program.fixture";
import type { Assignment } from "../Assignment";
import type { Program } from "../types";
import { ProgramQualityScoreEngine } from "./ProgramQualityScoreEngine";

const engine = new ProgramQualityScoreEngine();

function healthyProgram(): Program {
  const program = structuredClone(programFixture);
  const assignment = (id: string, entityId: string, displayName: string, entityType: Assignment["entityType"]): Assignment => ({
    id,
    entityId,
    displayName,
    entityType,
    role: "EXECUTOR",
    responsibilityType: "PRIMARY"
  });
  for (const goal of program.goals) {
    for (const objective of goal.objectives) {
      for (const activity of objective.activities) {
        activity.assignments = [assignment(`${activity.id}-assignment`, "unit-it", "IT Department", "UNIT")];
        for (const action of activity.actions) {
          action.assignments = [assignment(`${action.id}-assignment`, "person-1", "Project Manager", "PERSON")];
        }
      }
    }
  }
  return program;
}

describe("ProgramQualityScoreEngine", () => {
  it("gives a healthy program a high score across all dimensions", () => {
    const score = engine.calculate(healthyProgram(), createGovernanceReport(), [], { today: "۱۴۰۵/۰۱/۰۱", generatedAt: "2026-08-18T00:00:00.000Z" });

    expect(score.overallScore).toBeGreaterThanOrEqual(95);
    expect(score.dimensions).toEqual({
      hierarchy: 100,
      responsibility: 100,
      kpi: 100,
      timeline: 100,
      governance: 100
    });
    expect(score.generatedAt).toBe("2026-08-18T00:00:00.000Z");
  });

  it("reduces KPI quality when action KPI coverage is missing", () => {
    const program = healthyProgram();
    program.goals[0].objectives[0].activities[0].actions[0].kpis = [];
    const score = engine.calculate(program, createGovernanceReport(), [], { today: "۱۴۰۵/۰۱/۰۱" });

    expect(score.dimensions.kpi).toBeLessThan(100);
    expect(score.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "kpi.coverage.incomplete", dimension: "kpi" })
    ]));
  });

  it("reduces responsibility quality when primary responsibility is missing", () => {
    const program = healthyProgram();
    for (const objective of program.goals[0].objectives) {
      for (const activity of objective.activities) {
        activity.assignments = [];
        for (const action of activity.actions) action.assignments = [];
      }
    }
    const assessment = assessProgramResponsibilities(program);
    const score = engine.calculate(program, createGovernanceReport(), assessment);

    expect(score.dimensions.responsibility).toBeLessThan(100);
    expect(score.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ACTIVITY_WITHOUT_RESPONSIBLE_EXECUTOR" })
    ]));
  });

  it("reduces responsibility quality for overloaded owners", () => {
    const program = healthyProgram();
    const assessment = assessProgramResponsibilities(program, { individualAssignmentThreshold: 0 });
    const score = engine.calculate(program, createGovernanceReport(), assessment);

    expect(assessment).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "OVER_DEPENDENT_INDIVIDUAL" })
    ]));
    expect(score.dimensions.responsibility).toBeLessThan(100);
    expect(score.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "OVER_DEPENDENT_INDIVIDUAL" })
    ]));
  });
});
