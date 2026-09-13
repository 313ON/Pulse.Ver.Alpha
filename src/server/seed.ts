import { actionRecords, departments, dependencyRecords, goals, kpiRecords, riskRecords } from "../lib/data";
import { getDatabase } from "./db";
import { getPlanningContext } from "../domain/planning";
import { createIdentifierService } from "./identifier/IdentifierService";

const departmentIds: Record<string, string> = {
  "تولید": "production",
  "نت / نگهداری و تعمیرات": "maintenance",
  "آزمایشگاه و R&D": "rnd",
  "فناوری اطلاعات": "it",
  "تدارکات": "procurement",
  "اداری و منابع انسانی": "hr"
};

const seatRecords = [
  ["it-engineer", "مهندس فناوری اطلاعات", "it"],
  ["maintenance-engineer", "مهندس مکانیک - نت", "maintenance"],
  ["product-engineer", "مهندس محصول - پایلوت / تحقیق و توسعه", "rnd"],
  ["production-engineer", "مهندس شیمی - تولید", "production"],
  ["hr-specialist", "کارشناس منابع انسانی", "hr"]
];

export type SeedMode = "demo" | "reference";

export function getSeedMode(): SeedMode {
  const configured = process.env.PULSE_SEED_MODE?.trim().toLowerCase();
  if (configured === "demo" || configured === "reference") {
    if (process.env.NODE_ENV === "production" && configured === "demo") {
      throw new Error("PULSE_SEED_MODE=demo is not permitted in production.");
    }
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "reference" : "demo";
}

export function seedBaseline(): void {
  const db = getDatabase();
  const planning = getPlanningContext();
  const mode = getSeedMode();
  const seed = db.transaction(() => {
    const identifiers = createIdentifierService(db);
    const registerIfMissing = (table: string, id: string, type: Parameters<typeof identifiers.register>[1], pulse: string, external?: string | null) => {
      const current = db.prepare(`SELECT pulse_identifier FROM ${table} WHERE id=?`).get(id) as { pulse_identifier?: string | null } | undefined;
      if (current?.pulse_identifier) return;
      db.prepare(`UPDATE ${table} SET pulse_identifier=? WHERE id=?`).run(pulse, id);
      identifiers.register(id, type, pulse, external);
    };
    const insertDepartment = db.prepare("INSERT OR IGNORE INTO departments (id, name) VALUES (?, ?)");
    departments.forEach(([name]) => insertDepartment.run(departmentIds[name], name));
    departments.forEach(([name]) => registerIfMissing("departments", departmentIds[name], "department", identifiers.generate("department")));
    const insertSeat = db.prepare("INSERT OR IGNORE INTO seats (id, title, department_id) VALUES (?, ?, ?)");
    seatRecords.forEach(([id, title, departmentId]) => insertSeat.run(id, title, departmentId));
    seatRecords.forEach(([id]) => registerIfMissing("seats", id, "position", identifiers.generate("position")));
    const insertPerson = db.prepare("INSERT OR IGNORE INTO people (id, full_name, seat_id) VALUES (?, ?, ?)");
    seatRecords.forEach(([id, title]) => insertPerson.run(id, title, id));
    seatRecords.forEach(([id]) => registerIfMissing("people", id, "person", identifiers.generate("person")));
    if (mode !== "demo") return;
    const insertGoal = db.prepare("INSERT OR IGNORE INTO strategic_goals (id, title, plan_year) VALUES (@id, @title, @planYear)");
    goals.forEach(([id, title]) => insertGoal.run({ id, title, planYear: planning.planYear }));
    goals.forEach(([id]) => registerIfMissing("strategic_goals", id, "goal", id));
    const insertAction = db.prepare(`
      INSERT OR IGNORE INTO work_items
      (id, public_id, goal_id, department_id, owner_person_id, title, work_type, deliverable, status, progress, planned_start, planned_end, plan_year)
      VALUES (@id, @publicId, @goalId, @departmentId, @ownerPersonId, @title, @workType, @deliverable, @status, @progress, @plannedStart, @deadline, @planYear)
    `);
    actionRecords.forEach((action) => insertAction.run({
      id: `wi-${action.publicId}`,
      publicId: action.publicId,
      goalId: action.goalId,
      departmentId: action.departmentId,
      ownerPersonId: action.ownerPersonId,
      title: action.title,
      workType: action.workType,
      deliverable: action.deliverable,
      status: action.status,
      progress: action.progress,
      plannedStart: planning.startDate,
      deadline: action.deadline.replace(/^[^/]+(?=\/)/, String(planning.planYear)),
      planYear: planning.planYear
    }));
    actionRecords.forEach((action) => registerIfMissing("work_items", `wi-${action.publicId}`, "action", action.publicId));
    const insertKpi = db.prepare(`
      INSERT OR IGNORE INTO kpis
      (id, name, kind, unit, target, actual, direction, owner_person_id)
      VALUES (@id, @name, 'شاخص نتیجه', 'درصد', @target, @actual, @direction, 'production-engineer')
    `);
    kpiRecords.forEach((kpi) => insertKpi.run(kpi));
    const insertRisk = db.prepare(`
      INSERT OR IGNORE INTO risks
      (id, goal_id, title, probability, impact, owner_person_id, response_action, status)
      VALUES (@id, 'G06', @title, @probability, @impact, 'maintenance-engineer', @responseAction, @status)
    `);
    riskRecords.forEach((risk) => insertRisk.run(risk));
    const insertDependency = db.prepare(`
      INSERT OR IGNORE INTO dependencies
      (id, source_work_item_id, target_work_item_id, status, delay_days)
      VALUES (@id, @source, @target, @status, @delayDays)
    `);
    dependencyRecords.forEach((dependency, index) => insertDependency.run({
      id: `dep-${index + 1}`,
      source: `wi-${dependency.sourceWorkItemId}`,
      target: `wi-${dependency.targetWorkItemId}`,
      status: dependency.status,
      delayDays: dependency.delayDays
    }));
  });
  seed();
}
