import { describe, expect, it, vi } from "vitest";
import { ProgramCommandService } from "./ProgramCommandService";
import { ProgramMapper } from "./ProgramMapper";
import { ProgramQueryService } from "./ProgramQueryService";
import type { ProgramRepositoryPorts } from "./ports";

function createPorts(overrides: Partial<ProgramRepositoryPorts> = {}): ProgramRepositoryPorts {
  const ports: ProgramRepositoryPorts = {
    goals: {
      list: () => [{ id: "G01", title: "هدف اول", owner_person_id: "person-1", progress: 60 }],
      get: (id) => id === "G01" ? { id: "G01", title: "هدف اول" } : undefined,
      create: (input) => ({ id: input.id, title: input.title })
    },
    objectives: {
      list: () => [{ id: "O01", goal_id: "G01", title: "هدف جزئی اول", progress: 50 }],
      get: (id) => id === "O01" ? { id: "O01", goal_id: "G01", title: "هدف جزئی اول" } : undefined,
      create: (input) => ({ id: input.id, goal_id: input.goalId, title: input.title })
    },
    activities: {
      list: () => [{ id: "A01", sub_goal_id: "O01", title: "فعالیت اول", progress: 40 }],
      get: (id) => id === "A01" ? { id: "A01", sub_goal_id: "O01", title: "فعالیت اول" } : undefined,
      getUnscoped: (id) => id === "A01" ? { id: "A01", sub_goal_id: "O01", title: "فعالیت اول" } : undefined,
      create: (input) => ({ id: input.id ?? "A02", sub_goal_id: input.subGoalId, title: input.title })
    },
    actions: {
      list: () => [{
        id: "wi-1",
        public_id: "G01-O01-A01-T001",
        goal_id: "G01",
        sub_goal_id: "O01",
        activity_id: "A01",
        title: "اقدام اول",
        work_type: "اقدام",
        owner_person_id: "person-1",
        department_id: "department-1",
        owner: "مسئول اول",
        department: "واحد اول",
        deliverable: "خروجی اول",
        planned_start: "۱۴۰۵/۰۱/۰۱",
        planned_end: "۱۴۰۵/۰۲/۰۱",
        status: "در حال اجرا",
        progress: 35
      }],
      get: (id) => id === "G01-O01-A01-T001" ? { public_id: id } : undefined,
      create: (input) => input,
      update: (id, input) => ({ public_id: id, ...input })
    },
    kpis: {
      list: () => [{
        id: "kpi-1",
        work_item_id: "wi-1",
        name: "شاخص اول",
        actual: 80,
        target: 100,
        unit: "٪",
        direction: "higher-is-better",
        owner_person_id: "person-1",
        owner: "مسئول اول"
      }],
      get: (id) => id === "kpi-1" ? { id } : undefined
    }
  };
  return {
    ...ports,
    ...overrides,
    goals: { ...ports.goals, ...overrides.goals },
    objectives: { ...ports.objectives, ...overrides.objectives },
    activities: { ...ports.activities, ...overrides.activities },
    actions: { ...ports.actions, ...overrides.actions },
    kpis: { ...ports.kpis, ...overrides.kpis }
  };
}

describe("Program application services", () => {
  it("builds the canonical hierarchy and read-model summary", () => {
    const result = new ProgramQueryService(createPorts()).getProgram({
      id: "program-1405",
      title: "برنامه ۱۴۰۵"
    });

    expect(result.hierarchy.goals[0].objectives[0].activities[0].actions[0].kpis[0]).toMatchObject({
      id: "kpi-1",
      actionId: "G01-O01-A01-T001",
      target: 100,
      actual: 80
    });
    expect(result.summary).toMatchObject({
      goalCount: 1,
      objectiveCount: 1,
      activityCount: 1,
      actionCount: 1,
      kpiCount: 1,
      averageProgress: 35
    });
  });

  it("maps database-shaped rows into canonical entities", () => {
    const action = new ProgramMapper().action({
      id: "wi-1",
      public_id: "G01-O01-A01-T001",
      goal_id: "G01",
      activity_id: "A01",
      title: "اقدام",
      work_type: "اقدام",
      owner_person_id: "person-1",
      owner: "مسئول",
      department_id: "department-1",
      department: "واحد",
      deliverable: "خروجی",
      planned_start: "۱۴۰۵/۰۱/۰۱",
      planned_end: "۱۴۰۵/۰۲/۰۱",
      status: "شروع نشده",
      progress: 10
    });

    expect(action).toMatchObject({
      id: "G01-O01-A01-T001",
      ownerRef: { id: "person-1", label: "مسئول" },
      department: { id: "department-1", label: "واحد" },
      plannedEnd: "۱۴۰۵/۰۲/۰۱",
      externalIdentifiers: { publicId: "G01-O01-A01-T001" }
    });
  });

  it("rejects invalid parent relationships before persistence", () => {
    const actions = { create: vi.fn(), get: () => undefined, update: vi.fn(), list: () => [] };
    const service = new ProgramCommandService(createPorts({ actions }));

    expect(() => service.createAction({
      publicId: "G01-O01-A01-T002",
      goalId: "G01",
      objectiveId: "O01",
      activityId: "missing-activity",
      title: "اقدام نامعتبر",
      workType: "اقدام",
      departmentId: "department-1",
      ownerPersonId: "person-1",
      deliverable: "خروجی",
      deadline: "۱۴۰۵/۰۲/۰۱",
      status: "شروع نشده",
      progress: 0
    })).toThrow("related activity");
    expect(actions.create).not.toHaveBeenCalled();
  });

  it("validates canonical action data before calling the legacy repository", () => {
    const actions = { create: vi.fn(), get: () => undefined, update: vi.fn(), list: () => [] };
    const service = new ProgramCommandService(createPorts({ actions }));

    expect(() => service.createAction({
      publicId: "G01-O01-A01-T003",
      goalId: "G01",
      objectiveId: "O01",
      activityId: "A01",
      title: "اقدام بدون خروجی",
      workType: "اقدام",
      departmentId: "department-1",
      ownerPersonId: "person-1",
      deliverable: "",
      deadline: "۱۴۰۵/۰۲/۰۱",
      status: "شروع نشده",
      progress: 0
    })).toThrow("خروجی اقدام الزامی است");
    expect(actions.create).not.toHaveBeenCalled();
  });

  it("creates and updates through the canonical command boundary", () => {
    const create = vi.fn((input: Record<string, unknown>) => input);
    const update = vi.fn((id: string, input: Record<string, unknown>) => ({ id, ...input }));
    const actions = { create, get: () => ({ public_id: "G01-O01-A01-T001" }), update, list: () => [] };
    const service = new ProgramCommandService(createPorts({ actions }));

    service.createGoal({ id: "G02", title: "هدف جدید" });
    service.createObjective({ id: "O02", goalId: "G01", title: "هدف جزئی جدید" });
    service.createActivity({ id: "A02", objectiveId: "O01", title: "فعالیت جدید" });
    service.createAction({
      publicId: "G01-O01-A01-T004",
      goalId: "G01",
      objectiveId: "O01",
      activityId: "A01",
      title: "اقدام جدید",
      workType: "اقدام",
      departmentId: "department-1",
      ownerPersonId: "person-1",
      deliverable: "خروجی جدید",
      deadline: "۱۴۰۵/۰۲/۰۱",
      status: "شروع نشده",
      progress: 0
    });
    service.updateProgress("G01-O01-A01-T001", 75);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ publicId: "G01-O01-A01-T004" }));
    expect(update).toHaveBeenCalledWith("G01-O01-A01-T001", { progress: 75 });
  });
});
