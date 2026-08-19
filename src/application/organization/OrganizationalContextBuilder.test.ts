import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../server/auth";
import type { OrganizationRepository } from "../../server/organization";
import type {
  BusinessRole,
  Expertise,
  Person,
  Position,
  Unit
} from "../../domain/organization";
import type { ContextProgramAssignment, OrganizationalContextReadPort } from "./OrganizationalContext";
import { OrganizationalContextBuilder } from "./OrganizationalContextBuilder";

const units: Unit[] = [
  { id: "it", name: "فناوری اطلاعات", status: "ACTIVE" },
  { id: "rnd", name: "آزمایشگاه و R&D", status: "ACTIVE" }
];
const positions: Position[] = [
  { id: "it-engineer", title: "مهندس فناوری اطلاعات", unitId: "it" },
  { id: "rnd-engineer", title: "مهندس محصول", unitId: "rnd" }
];
const people: Person[] = [
  { id: "it-person", fullName: "شخص فناوری", status: "ACTIVE", positionId: "it-engineer" },
  { id: "rnd-person", fullName: "شخص تحقیق", status: "ACTIVE", positionId: "rnd-engineer" },
  { id: "unassigned", fullName: "شخص بدون سمت", status: "ACTIVE" }
];

const assignments: ContextProgramAssignment[] = [
  {
    id: "assignment-it",
    entityType: "PERSON",
    entityId: "it-person",
    displayName: "شخص فناوری",
    role: "OWNER",
    responsibilityType: "PRIMARY",
    programEntityId: "G10-O02-A01-T001",
    planYear: 1405
  },
  {
    id: "assignment-rnd",
    entityType: "PERSON",
    entityId: "rnd-person",
    displayName: "شخص تحقیق",
    role: "EXECUTOR",
    responsibilityType: "PRIMARY",
    programEntityId: "G01-O01-A01-T001",
    planYear: 1405
  },
  {
    id: "assignment-unit",
    entityType: "UNIT",
    entityId: "it",
    displayName: "فناوری اطلاعات",
    role: "COLLABORATOR",
    responsibilityType: "SUPPORT",
    programEntityId: "G10-O02-A01-T001",
    planYear: 1404
  },
  {
    id: "assignment-unknown",
    entityType: "PERSON",
    entityId: "unknown-person",
    displayName: "شخص ناشناخته",
    role: "COLLABORATOR",
    responsibilityType: "SUPPORT",
    programEntityId: "G10-O02-A01-T001",
    planYear: 1405
  }
];

const organization: OrganizationRepository = {
  listUnits: () => units,
  getUnit: (id) => units.find((unit) => unit.id === id),
  listPositions: () => positions,
  getPosition: (id) => positions.find((position) => position.id === id),
  listPeople: () => people,
  getPerson: (id) => people.find((person) => person.id === id),
  getPersonPosition: (id) => {
    const person = people.find((candidate) => candidate.id === id);
    return person?.positionId ? positions.find((position) => position.id === person.positionId) : undefined;
  },
  getPositionUnit: (id) => {
    const position = positions.find((candidate) => candidate.id === id);
    return position ? units.find((unit) => unit.id === position.unitId) : undefined;
  },
  getDerivedPersonUnit: (id) => {
    const person = people.find((candidate) => candidate.id === id);
    const position = person?.positionId ? positions.find((candidate) => candidate.id === person.positionId) : undefined;
    return position ? { personId: id, unitId: position.unitId, derivation: "POSITION" } : undefined;
  }
};

const readSide: OrganizationalContextReadPort = {
  listAssignments: () => assignments,
  listHistoricalEvidence: () => [{
    reference: {
      workbook: "Version 7 Khordad 1404.xlsx",
      sheet: "Organization",
      row: 7,
      column: "B",
      cell: "B8",
      sourceYear: 1404
    },
    entityType: "PERSON",
    entityId: "it-person",
    sourceOnly: true
  }],
  listPersonRoles: (): BusinessRole[] => [],
  listPersonExpertise: (): Expertise[] => []
};

const builder = new OrganizationalContextBuilder({ organization, readSide });
const company: SessionUser = { id: "company", username: "company", role: "MANAGEMENT", scope: "COMPANY" };
const itManager: SessionUser = { id: "it-manager", username: "it-manager", role: "UNIT_MANAGER", scope: "DEPARTMENT", department_id: "it" };
const itPerson: SessionUser = { id: "it-person", username: "it-person", role: "EMPLOYEE", scope: "OWN", person_id: "it-person" };
const rndPerson: SessionUser = { id: "rnd-person", username: "rnd-person", role: "EMPLOYEE", scope: "OWN", person_id: "rnd-person" };

describe("OrganizationalContextBuilder", () => {
  it("is deterministic for identical canonical inputs", () => {
    const first = builder.build({ type: "PERSON", id: "it-person" }, company, "2026-08-19T00:00:00.000Z");
    const second = builder.build({ type: "PERSON", id: "it-person" }, company, "2026-08-19T00:00:00.000Z");
    expect(first).toEqual(second);
  });

  it("resolves Person to Position to Unit deterministically", () => {
    const context = builder.build({ type: "PERSON", id: "it-person" }, company, "now");
    expect(context.person).toMatchObject({ status: "KNOWN", value: { id: "it-person" } });
    expect(context.position).toMatchObject({ status: "KNOWN", value: { id: "it-engineer" } });
    expect(context.unit).toMatchObject({ status: "KNOWN", value: { id: "it" } });
  });

  it("represents missing Position and Unit explicitly", () => {
    const context = builder.build({ type: "PERSON", id: "unassigned" }, company, "now");
    expect(context.position).toEqual({ status: "MISSING", reason: "POSITION_NOT_ASSIGNED" });
    expect(context.unit).toEqual({ status: "MISSING", reason: "UNIT_NOT_DERIVED" });
  });

  it("keeps BusinessRole and Expertise empty without canonical data", () => {
    const context = builder.build({ type: "PERSON", id: "it-person" }, company, "now");
    expect(context.businessRoles).toEqual([]);
    expect(context.expertise).toEqual([]);
  });

  it("keeps only current 1405 assignments and excludes historical evidence from canonical assignments", () => {
    const context = builder.build({ type: "PERSON", id: "it-person" }, company, "now");
    expect(context.assignments).toHaveLength(1);
    expect(context.assignments[0].planYear).toBe(1405);
    expect(context.historicalEvidence[0].reference.sourceYear).toBe(1404);
  });

  it("moves current assignments with historical provenance into source-only evidence", () => {
    const historicalReference = {
      workbook: "Version 7 Khordad 1404.xlsx",
      sheet: "Organization",
      row: 7,
      column: "B",
      cell: "B8",
      sourceYear: 1404
    };
    const readSideWithHistoricalAssignment: OrganizationalContextReadPort = {
      ...readSide,
      listAssignments: () => [{
        ...assignments[0],
        provenance: historicalReference
      }]
    };
    const historicalContext = new OrganizationalContextBuilder({
      organization,
      readSide: readSideWithHistoricalAssignment
    }).build({ type: "PERSON", id: "it-person" }, company, "now");

    expect(historicalContext.assignments).toEqual([]);
    expect(historicalContext.historicalEvidence).toContainEqual({
      reference: historicalReference,
      entityType: "PERSON",
      entityId: "it-person",
      sourceOnly: true
    });
  });

  it("preserves unresolved assignment references", () => {
    const context = builder.build({ type: "PROGRAM_ENTITY", id: "G10-O02-A01-T001" }, company, "now");
    expect(context.unresolvedReferences).toEqual([expect.objectContaining({
      entityType: "PERSON",
      externalId: "unknown-person",
      resolutionStatus: "UNKNOWN"
    })]);
  });

  it("enforces OWN, DEPARTMENT, and COMPANY authorization scopes", () => {
    expect(builder.build({ type: "PERSON", id: "rnd-person" }, itPerson, "now").authorizationScope.subjectVisible).toBe(false);
    expect(builder.build({ type: "UNIT", id: "rnd" }, itManager, "now").authorizationScope.subjectVisible).toBe(false);
    expect(builder.build({ type: "UNIT", id: "rnd" }, company, "now").authorizationScope.subjectVisible).toBe(true);
  });

  it("filters program assignments by authorized person and unit", () => {
    const own = builder.build({ type: "PROGRAM_ENTITY", id: "G10-O02-A01-T001" }, itPerson, "now");
    const department = builder.build({ type: "PROGRAM_ENTITY", id: "G10-O02-A01-T001" }, itManager, "now");
    const companyContext = builder.build({ type: "PROGRAM_ENTITY", id: "G10-O02-A01-T001" }, company, "now");
    expect(own.assignments).toHaveLength(1);
    expect(department.assignments).toHaveLength(1);
    expect(companyContext.assignments).toHaveLength(2);
  });

  it("does not mutate the injected read-side sources", () => {
    const before = JSON.stringify({ units, positions, people, assignments });
    builder.build({ type: "UNIT", id: "it" }, company, "now");
    expect(JSON.stringify({ units, positions, people, assignments })).toBe(before);
  });
});
