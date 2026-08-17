import { actionRecords, departments, dependencyRecords, goals, kpiRecords, riskRecords } from "../lib/data";
import { getDatabase } from "./db";

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

export function seedBaseline(): void {
  const db = getDatabase();
  const seed = db.transaction(() => {
    const insertDepartment = db.prepare("INSERT OR IGNORE INTO departments (id, name) VALUES (?, ?)");
    departments.forEach(([name]) => insertDepartment.run(departmentIds[name], name));
    const insertSeat = db.prepare("INSERT OR IGNORE INTO seats (id, title, department_id) VALUES (?, ?, ?)");
    seatRecords.forEach(([id, title, departmentId]) => insertSeat.run(id, title, departmentId));
    const insertPerson = db.prepare("INSERT OR IGNORE INTO people (id, full_name, seat_id) VALUES (?, ?, ?)");
    seatRecords.forEach(([id, title]) => insertPerson.run(id, title, id));
    const insertGoal = db.prepare("INSERT OR IGNORE INTO strategic_goals (id, title, plan_year) VALUES (?, ?, 1405)");
    goals.forEach(([id, title]) => insertGoal.run(id, title));
    const insertAction = db.prepare(`
      INSERT OR IGNORE INTO work_items
      (id, public_id, goal_id, department_id, owner_person_id, title, work_type, deliverable, status, progress, planned_start, planned_end, plan_year)
      VALUES (@id, @publicId, @goalId, @departmentId, @ownerPersonId, @title, @workType, @deliverable, @status, @progress, '۱۴۰۵/۰۱/۰۱', @deadline, 1405)
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
      deadline: action.deadline
    }));
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
