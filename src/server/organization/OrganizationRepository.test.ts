import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { closeDatabase } from "../db";
import { seedBaseline } from "../seed";
import { seedAuthFoundation } from "../auth";
import { SQLiteOrganizationRepository } from "./OrganizationRepository";
import {
  unresolvedOrganizationalReference,
  type OrganizationalProvenanceReference
} from "../../domain/organization";

let testDatabasePath = "";

beforeEach(() => {
  closeDatabase();
  testDatabasePath = path.join(os.tmpdir(), `pulse-organization-${Date.now()}-${Math.random()}.sqlite`);
  process.env.PULSE_DB_PATH = testDatabasePath;
  process.env.PULSE_ADMIN_PASSWORD = "test-admin-password-123";
  seedBaseline();
});

describe("SQLite organizational foundation", () => {
  it("maps departments to Units", () => {
    const repository = new SQLiteOrganizationRepository();
    expect(repository.getUnit("it")).toEqual({
      id: "it",
      name: "فناوری اطلاعات",
      status: "ACTIVE"
    });
  });

  it("maps seats to Positions without treating them as roles", () => {
    const repository = new SQLiteOrganizationRepository();
    expect(repository.getPosition("it-engineer")).toEqual({
      id: "it-engineer",
      title: "مهندس فناوری اطلاعات",
      unitId: "it"
    });
    expect(repository.listBusinessRoles()).toEqual([]);
  });

  it("maps people to Persons and resolves Person to Position", () => {
    const repository = new SQLiteOrganizationRepository();
    expect(repository.getPerson("it-engineer")).toMatchObject({
      id: "it-engineer",
      fullName: "مهندس فناوری اطلاعات",
      status: "ACTIVE",
      positionId: "it-engineer"
    });
    expect(repository.getPersonPosition("it-engineer")).toMatchObject({
      id: "it-engineer",
      unitId: "it"
    });
  });

  it("resolves Position to Unit and derives Person to Unit", () => {
    const repository = new SQLiteOrganizationRepository();
    expect(repository.getPositionUnit("it-engineer")).toEqual({
      id: "it",
      name: "فناوری اطلاعات",
      status: "ACTIVE"
    });
    expect(repository.getDerivedPersonUnit("it-engineer")).toEqual({
      personId: "it-engineer",
      unitId: "it",
      derivation: "POSITION"
    });
  });

  it("keeps authorization roles separate from organizational roles", () => {
    seedAuthFoundation();
    const repository = new SQLiteOrganizationRepository();
    expect(repository.listBusinessRoles()).toEqual([]);
  });

  it("does not map legacy work-item role references to BusinessRole", () => {
    const database = new Database(testDatabasePath);
    database.prepare("UPDATE work_items SET role_id = ? WHERE public_id = ?").run("legacy-role-value", "G10-O02-A01-T001");
    database.close();

    closeDatabase();
    const repository = new SQLiteOrganizationRepository();
    expect(repository.listBusinessRoles()).toEqual([]);
  });

  it("reads the base schema without triggering runtime schema initialization", () => {
    closeDatabase();
    const baseSchemaDatabasePath = path.join(os.tmpdir(), `pulse-organization-base-${Date.now()}-${Math.random()}.sqlite`);
    const database = new Database(baseSchemaDatabasePath);
    database.exec(fs.readFileSync(path.join(process.cwd(), "db", "schema.sqlite.sql"), "utf8"));
    const before = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;
    database.close();

    expect(before.some((table) => table.name === "activities")).toBe(false);
    expect(before.some((table) => table.name === "app_roles")).toBe(false);

    process.env.PULSE_DB_PATH = baseSchemaDatabasePath;
    const repository = new SQLiteOrganizationRepository();
    expect(repository.getUnit("it")).toBeUndefined();

    const after = new Database(baseSchemaDatabasePath, { readonly: true });
    const tables = after
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;
    after.close();

    expect(tables).toEqual(before);
  });

  it("leaves unknown organizational references unresolved", () => {
    expect(
      unresolvedOrganizationalReference("UNIT", "واحد ناشناخته", "واحد ناشناخته")
    ).toEqual({
      entityType: "UNIT",
      sourceLabel: "واحد ناشناخته",
      normalizedLabel: "واحد ناشناخته",
      resolutionStatus: "UNKNOWN"
    });
  });

  it("preserves spreadsheet provenance in a typed reference", () => {
    const provenance: OrganizationalProvenanceReference = {
      workbook: "Version 7 Khordad 1404.xlsx",
      sheet: "Organization",
      row: 7,
      column: "B",
      cell: "B8",
      sourceYear: 1404
    };
    expect(provenance).toMatchObject({
      workbook: "Version 7 Khordad 1404.xlsx",
      sheet: "Organization",
      row: 7,
      column: "B",
      cell: "B8",
      sourceYear: 1404
    });
  });
});
