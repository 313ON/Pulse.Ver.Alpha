import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "../db";
import { seedBaseline } from "../seed";
import { createIdentifierService } from "./IdentifierService";
import { ActionRepository } from "../repositories";

beforeEach(() => {
  closeDatabase();
  process.env.PULSE_DB_PATH = path.join(os.tmpdir(), `pulse-identifiers-${Date.now()}-${Math.random()}.sqlite`);
  process.env.PULSE_ADMIN_PASSWORD = "test-admin-password-123";
  seedBaseline();
});

describe("system-owned PULSE identifiers", () => {
  it("allocates goals and actions from one authoritative service", () => {
    const database = getDatabase();
    const service = createIdentifierService(database);
    expect(service.generate("goal")).toMatch(/^G\d+$/);
    expect(service.generate("goal")).toMatch(/^G\d+$/);
    const first = service.generate("action", { planYear: 1405, goalId: "G10", objectiveId: "O02", activityId: "A01", shapeHint: "G10-O02-A01-T001" });
    const second = service.generate("action", { planYear: 1405, goalId: "G10", objectiveId: "O02", activityId: "A01", shapeHint: "G10-O02-A01-T001" });
    expect(first).toMatch(/^G10-O02-A01-T\d{3}$/);
    expect(Number(second.slice(-3))).toBe(Number(first.slice(-3)) + 1);
  });

  it("does not reuse an allocated action after deletion", () => {
    const database = getDatabase();
    const service = createIdentifierService(database);
    const first = service.generate("action", { planYear: 1405, goalId: "G10", objectiveId: "O99", activityId: "A99", shapeHint: "G10-O99-A99-T001" });
    database.prepare(`INSERT INTO work_items
      (id, public_id, goal_id, title, department_id, owner_person_id, deliverable, planned_end, status, progress, plan_year)
      VALUES (?, ?, 'G10', 'allocated', 'it', 'it-engineer', 'output', '۱۴۰۵/۰۷/۱۵', 'شروع نشده', 0, 1405)`).run(`technical-${first}`, first);
    database.prepare("DELETE FROM work_items WHERE public_id=?").run(first);
    const next = service.generate("action", { planYear: 1405, goalId: "G10", objectiveId: "O99", activityId: "A99", shapeHint: first });
    expect(next).not.toBe(first);
  });

  it("allocates concurrent requests uniquely", async () => {
    const database = getDatabase();
    const service = createIdentifierService(database);
    const values = await Promise.all(Array.from({ length: 20 }, () => Promise.resolve(service.generate("action", {
      planYear: 1405, goalId: "G10", objectiveId: "O77", activityId: "A77", shapeHint: "G10-O77-A77-T001"
    }))));
    expect(new Set(values).size).toBe(values.length);
  });

  it("keeps external source identity separate from the generated PULSE identifier", () => {
    const created = new ActionRepository().create({
      goalId: "G10", title: "imported source", workType: "اقدام", departmentId: "it", ownerPersonId: "it-engineer",
      deliverable: "output", deadline: "۱۴۰۵/۰۷/۱۵", status: "شروع نشده", progress: 0, externalSourceId: "legacy-42"
    } as never) as { public_id: string; external_source_id: string };
    expect(created.public_id).toMatch(/^G10-O01-A01-T\d{3}$/);
    expect(created.external_source_id).toBe("legacy-42");
    expect(created.public_id).not.toBe("legacy-42");
  });
});
