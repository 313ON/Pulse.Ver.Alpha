import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "./db";
import { seedBaseline } from "./seed";
import { ActionRepository, ActivityRepository, DependencyRepository, PersonRepository, RepositoryError, RoleRepository, SubGoalRepository, UserRepository } from "./repositories";
import { audit, canScope, seedAuthFoundation, type SessionUser } from "./auth";

let testDatabasePath = "";

beforeEach(() => {
  closeDatabase();
  testDatabasePath = path.join(os.tmpdir(), `pulse-test-${Date.now()}-${Math.random()}.sqlite`);
  process.env.PULSE_DB_PATH = testDatabasePath;
  seedBaseline();
});

describe("SQLite repositories", () => {
  it("seeds and lists the approved 1405 baseline", () => {
    const actions = new ActionRepository().list() as Array<{ public_id: string }>;
    expect(actions).toHaveLength(6);
    expect(actions.every((action) => action.public_id.startsWith("G"))).toBe(true);
  });

  it("persists an action and reads it back", () => {
    const repository = new ActionRepository();
    const created = repository.create({
      publicId: "G10-O99-A99-T901",
      goalId: "G10",
      title: "اقدام پایدارسازی تست",
      workType: "اقدام",
      departmentId: "it",
      ownerPersonId: "it-engineer",
      deliverable: "گزارش تست",
      deadline: "۱۴۰۵/۰۷/۱۵",
      plannedStart: "۱۴۰۵/۰۷/۰۱",
      status: "شروع نشده",
      progress: 0
    }) as { public_id: string };
    expect(created.public_id).toBe("G10-O99-A99-T901");
    expect(repository.get("G10-O99-A99-T901")).toBeTruthy();
  });

  it("rejects duplicate action IDs and invalid progress", () => {
    const repository = new ActionRepository();
    expect(() => repository.create({
      publicId: "G10-O02-A01-T001",
      goalId: "G10",
      title: "تکراری",
      workType: "اقدام",
      departmentId: "it",
      ownerPersonId: "it-engineer",
      deliverable: "خروجی",
      deadline: "۱۴۰۵/۰۷/۱۵",
      status: "شروع نشده",
      progress: 0
    })).toThrow(RepositoryError);
    expect(() => repository.create({
      publicId: "G10-O99-A99-T902",
      goalId: "G10",
      title: "پیشرفت نادرست",
      workType: "اقدام",
      departmentId: "it",
      ownerPersonId: "it-engineer",
      deliverable: "خروجی",
      deadline: "۱۴۰۵/۰۷/۱۵",
      status: "شروع نشده",
      progress: 101
    })).toThrow(RepositoryError);
  });

  it("protects foreign keys and prevents unresolved self-dependencies", () => {
    const db = getDatabase();
    expect(() => db.prepare("INSERT INTO dependencies (id, source_work_item_id, target_work_item_id) VALUES ('bad','missing','missing2')").run()).toThrow();
    expect(() => new DependencyRepository().create({
      sourceWorkItemId: "wi-G10-O02-A01-T001",
      targetWorkItemId: "wi-G10-O02-A01-T001",
      status: "باز",
      delayDays: 0
    })).toThrow(RepositoryError);
  });

  it("creates and updates an activity under a sub-goal and exposes linked actions", () => {
    new SubGoalRepository().create({ id: "SG01", goalId: "G10", title: "زیرهدف تستی", ownerPersonId: "it-engineer" });
    const activities = new ActivityRepository();
    const created = activities.create({
      id: "activity-it-1",
      subGoalId: "SG01",
      title: "فعالیت تستی",
      description: "شرح فعالیت",
      ownerPersonId: "it-engineer"
    }) as { id: string };
    expect(created.id).toBe("activity-it-1");
    activities.update(created.id, { title: "فعالیت به‌روزشده" });
    new ActionRepository().create({
      publicId: "G10-O99-A99-T903",
      goalId: "G10",
      title: "اقدام متصل به فعالیت",
      workType: "اقدام",
      departmentId: "it",
      ownerPersonId: "it-engineer",
      deliverable: "خروجی",
      deadline: "۱۴۰۵/۰۷/۱۵",
      status: "شروع نشده",
      progress: 0,
      activityId: created.id
    });
    expect(activities.get(created.id)).toMatchObject({ title: "فعالیت به‌روزشده", activity_action_count: 1, related_actions: "G10-O99-A99-T903" });
  });

  it("rejects invalid activity input and isolates department/own scopes", () => {
    new SubGoalRepository().create({ id: "SG01", goalId: "G10", title: "زیرهدف تستی", ownerPersonId: "it-engineer" });
    const activities = new ActivityRepository();
    expect(() => activities.create({ subGoalId: "missing", title: "نامعتبر", ownerPersonId: "it-engineer" })).toThrow(RepositoryError);
    activities.create({ id: "activity-it-2", subGoalId: "SG01", title: "فعالیت فناوری", ownerPersonId: "it-engineer" });
    activities.create({ id: "activity-rnd-1", subGoalId: "SG01", title: "فعالیت تحقیق", ownerPersonId: "product-engineer" });
    const unit = { id: "unit", username: "unit", role: "UNIT_MANAGER", scope: "DEPARTMENT", department_id: "it" } as SessionUser;
    const employee = { id: "employee", username: "employee", role: "EMPLOYEE", scope: "OWN", person_id: "it-engineer" } as SessionUser;
    expect(activities.list(unit).every((item) => (item as { department_id?: string }).department_id === "it")).toBe(true);
    expect(activities.list(employee).every((item) => (item as { owner_person_id?: string }).owner_person_id === "it-engineer")).toBe(true);
    expect(canScope(unit, { departmentId: "rnd" })).toBe(false);
    expect(canScope(employee, { ownerPersonId: "product-engineer" })).toBe(false);
  });

  it("writes an audit event for an activity mutation", () => {
    seedAuthFoundation();
    const db = getDatabase();
    const actor = db.prepare("SELECT id FROM users WHERE username = 'admin'").get() as { id: string };
    audit(actor.id, "activity", "activity-audit", "created", null, { title: "ثبت شد" });
    expect(db.prepare("SELECT entity_type, event_type, after_json FROM audit_log WHERE entity_id = ?").get("activity-audit")).toMatchObject({ entity_type: "activity", event_type: "created" });
  });

  it("supports partial master-data updates without undefined SQLite bindings", () => {
    const roles = new RoleRepository();
    const people = new PersonRepository();
    const users = new UserRepository();
    seedAuthFoundation();

    roles.create({ id: "test-seat", title: "Test seat", departmentId: "it" });
    people.create({ id: "test-person", fullName: "Test person", seatId: "test-seat" });
    users.create({ id: "test-user", username: "test-user", password: "test-password-123", personId: "test-person", departmentId: "it", roleId: "role-employee" });

    expect(roles.update("test-seat", { title: "Updated seat" })).toMatchObject({ title: "Updated seat", department_id: "it" });
    expect(people.update("test-person", { fullName: "Updated person" })).toMatchObject({ full_name: "Updated person", seat_id: "test-seat" });
    expect(users.update("test-user", { active: false })).toMatchObject({ username: "test-user", active: 0 });
  });
});
