import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "../../server/db";
import { seedBaseline } from "../../server/seed";
import type { SessionUser } from "../../server/auth";
import { SQLiteOperationalProgramReadRepository } from "../../server/reporting/OperationalProgramReadRepository";
import { ReadOnlyProgramQueryService, ProductionGovernedOperationalReportService } from "./index";
import { programIdentity } from "./ProgramEntityIdentity";

const generatedAt = "2026-08-19T00:00:00.000Z";

function user(scope: SessionUser["scope"], person_id?: string, department_id?: string): SessionUser {
  return {
    id: `${scope.toLowerCase()}-user`,
    username: `${scope.toLowerCase()}-user`,
    role: scope === "COMPANY" ? "MANAGEMENT" : scope === "DEPARTMENT" ? "UNIT_MANAGER" : "EMPLOYEE",
    scope,
    person_id,
    department_id
  };
}

function productionProgram() {
  return new ReadOnlyProgramQueryService(new SQLiteOperationalProgramReadRepository()).getProgram({
    id: programIdentity(1405),
    title: "برنامه سالانه تحول دیجیتال ۱۴۰۵",
    status: "در حال اجرا",
    priority: "متوسط"
  }).hierarchy;
}

function materializeOperationalHierarchy() {
  const database = getDatabase();
  const actionRows = database.prepare("SELECT id, public_id FROM work_items").all() as Array<{ id: string; public_id: string }>;
  for (const row of actionRows) {
    const match = /^(G\d{2})-(O\d{2})-(A\d{2})-T\d{3}$/.exec(row.public_id);
    if (!match) continue;
    const [, goalId, objectiveCode, activityCode] = match;
    const objectiveId = `${goalId}-${objectiveCode}`;
    const activityId = `${objectiveId}-${activityCode}`;
    database.prepare(`
      INSERT OR IGNORE INTO sub_goals (id, goal_id, title, owner_person_id)
      VALUES (?, ?, ?, 'it-engineer')
    `).run(objectiveId, goalId, `هدف جزئی ${objectiveCode}`);
    database.prepare(`
      INSERT OR IGNORE INTO activities (id, sub_goal_id, title, owner_person_id)
      VALUES (?, ?, ?, 'it-engineer')
    `).run(activityId, objectiveId, `فعالیت ${activityCode}`);
    database.prepare("UPDATE work_items SET sub_goal_id = ?, activity_id = ? WHERE id = ?")
      .run(objectiveId, activityId, row.id);
  }
  closeDatabase();
}

beforeEach(() => {
  closeDatabase();
  process.env.PULSE_DB_PATH = path.join(os.tmpdir(), `pulse-reporting-path-${Date.now()}-${Math.random()}.sqlite`);
  seedBaseline();
  const database = getDatabase();
  database.prepare("UPDATE strategic_goals SET owner_person_id = 'it-engineer'").run();
  database.prepare(`
    INSERT INTO work_item_collaborators (work_item_id, person_id)
    VALUES ('wi-G10-O02-A01-T001', 'maintenance-engineer')
  `).run();
  closeDatabase();
});

describe("governed reporting production data path", () => {
  it("reads SQLite actions, reconstructs only missing structural hierarchy, and preserves authoritative assignments", () => {
    const program = productionProgram();
    const report = new ProductionGovernedOperationalReportService().report(
      program,
      user("COMPANY"),
      generatedAt
    );

    expect(report.program.id).toBe("program-1405");
    expect(report.summary.goals).toBe(10);
    expect(report.summary.actions).toBe(6);
    expect(report.summary.objectives).toBeGreaterThan(0);
    expect(report.summary.activities).toBeGreaterThan(0);
    expect(report.rows.some((row) => row.id === "G10-O02-A01-T001")).toBe(true);
    expect(report.rows.some((row) => row.type === "activity" && row.title.includes("عنوان ثبت نشده"))).toBe(true);
    expect(report.provenance.length).toBeGreaterThan(0);

    const identity = program.goals
      .find((goal) => goal.id === "G10")
      ?.objectives.find((objective) => objective.id === "G10-O02");
    expect(identity?.activities.find((activity) => activity.id === "G10-O02-A01")?.actions[0].id)
      .toBe("G10-O02-A01-T001");
  });

  it("enforces COMPANY, DEPARTMENT, and OWN visibility from assignment relationships", () => {
    materializeOperationalHierarchy();
    const program = productionProgram();
    const service = new ProductionGovernedOperationalReportService();
    const company = service.report(program, user("COMPANY"), generatedAt);
    const itDepartment = service.report(program, user("DEPARTMENT", undefined, "it"), generatedAt);
    const own = service.report(program, user("OWN", "it-engineer"), generatedAt);
    const unrelatedOwner = service.report(program, user("OWN", "hr-specialist"), generatedAt);

    expect(company.rows.some((row) => row.id === "G10-O02-A01-T001")).toBe(true);
    expect(itDepartment.rows.some((row) => row.id === "G10-O02-A01-T001")).toBe(true);
    expect(own.rows.some((row) => row.id === "G10-O02-A01-T001")).toBe(true);
    expect(unrelatedOwner.rows.some((row) => row.id === "G10-O02-A01-T001")).toBe(false);
    expect(unrelatedOwner.rows
      .find((row) => row.id === "G07-O02-A01-T003")
      ?.eligibleAssignmentIds.length).toBeGreaterThan(0);
  });

  it("does not turn missing activity ownership into an invented assignment", () => {
    const program = productionProgram();
    const activity = program.goals
      .flatMap((goal) => goal.objectives)
      .flatMap((objective) => objective.activities)
      .find((candidate) => candidate.id === "G10-O02-A01");

    expect(activity?.assignments).toEqual([]);
    expect(activity?.actions[0].assignments.map((assignment) => assignment.entityId)).toContain("it-engineer");
  });
});
