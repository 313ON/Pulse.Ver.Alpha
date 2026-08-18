import path from "node:path";
import os from "node:os";
import { beforeEach, describe, expect, it } from "vitest";
import { closeDatabase } from "../db";
import { seedBaseline } from "../seed";
import { KPIRepository } from "../repositories";
import { createProgramServices } from "./services";

beforeEach(() => {
  closeDatabase();
  process.env.PULSE_DB_PATH = path.join(os.tmpdir(), `pulse-program-${Date.now()}-${Math.random()}.sqlite`);
  seedBaseline();
});

describe("program persistence adapters", () => {
  it("persists and reads a complete canonical program hierarchy", () => {
    const { commands, query } = createProgramServices();

    commands.createGoal({ id: "G99", title: "برنامه آزمایشی" });
    commands.createObjective({ id: "O99", goalId: "G99", title: "هدف اجرایی آزمایشی" });
    commands.createActivity({ id: "A99", objectiveId: "O99", title: "فعالیت آزمایشی" });
    commands.createAction({
      publicId: "G99-O99-A99-T001",
      goalId: "G99",
      objectiveId: "O99",
      activityId: "A99",
      title: "اقدام آزمایشی",
      workType: "اقدام",
      departmentId: "it",
      ownerPersonId: "it-engineer",
      deliverable: "خروجی آزمایشی",
      deadline: "۱۴۰۵/۰۷/۱۵",
      plannedStart: "۱۴۰۵/۰۷/۰۱",
      status: "در حال اجرا",
      progress: 72
    });
    new KPIRepository().create({
      id: "KPI-99",
      workItemId: "G99-O99-A99-T001",
      name: "تحقق خروجی",
      actual: 72,
      target: 80,
      direction: "higher-is-better",
      unit: "درصد",
      ownerPersonId: "it-engineer"
    });

    const result = query.getProgram({ id: "program-1405", title: "برنامه ۱۴۰۵" });
    const action = result.hierarchy.goals
      .find((goal) => goal.id === "G99")
      ?.objectives[0].activities[0].actions[0];

    expect(action).toMatchObject({
      id: "G99-O99-A99-T001",
      goalId: "G99",
      objectiveId: "O99",
      activityId: "A99",
      progress: 72,
      externalIdentifiers: { publicId: "G99-O99-A99-T001" }
    });
    expect(action?.kpis[0]).toMatchObject({
      id: "KPI-99",
      actionId: "G99-O99-A99-T001",
      actual: 72,
      target: 80
    });
    expect(result.hierarchy.goals.find((goal) => goal.id === "G99")?.objectives[0].activities[0].title)
      .toBe("فعالیت آزمایشی");
    expect(result.summary).toMatchObject({
      goalCount: 11,
      objectiveCount: 1,
      activityCount: 1,
      actionCount: 1,
      averageProgress: 72
    });
    expect(result.summary.kpis).toMatchObject({ total: 5, atRisk: 4 });
  });
});
