import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "./db";
import { seedBaseline } from "./seed";
import { ActionRepository, DependencyRepository, RepositoryError } from "./repositories";

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
});
