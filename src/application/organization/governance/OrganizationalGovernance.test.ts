import { describe, expect, it } from "vitest";
import type {
  BusinessRole,
  Expertise,
  Person,
  Position,
  Unit
} from "../../../domain/organization";
import type {
  ContextProgramAssignment,
  OrganizationalContext
} from "../OrganizationalContext";
import {
  createOrganizationalContextSnapshot
} from "../OrganizationalContextHardening";
import {
  evaluateOrganizationalGovernance,
  type OrganizationalGovernanceIdentityReadPort,
  type OrganizationalGovernanceCanonicalFactReadPort
} from "./OrganizationalGovernance";

const units: Unit[] = [
  { id: "it", name: "IT", status: "ACTIVE" },
  { id: "rnd", name: "R&D", status: "ACTIVE" },
  { id: "inactive-unit", name: "Inactive", status: "INACTIVE" }
];
const positions: Position[] = [
  { id: "it-position", title: "IT Position", unitId: "it" },
  { id: "rnd-position", title: "R&D Position", unitId: "rnd" }
];
const people: Person[] = [
  { id: "person-1", fullName: "Person One", status: "ACTIVE", positionId: "it-position" },
  { id: "person-rnd", fullName: "Person R&D", status: "ACTIVE", positionId: "rnd-position" },
  { id: "inactive-person", fullName: "Inactive Person", status: "INACTIVE", positionId: "it-position" },
  { id: "unassigned", fullName: "Unassigned", status: "ACTIVE" }
];

const identity: OrganizationalGovernanceIdentityReadPort = {
  getPerson: (id) => people.find((item) => item.id === id),
  getPosition: (id) => positions.find((item) => item.id === id),
  getUnit: (id) => units.find((item) => item.id === id)
};
const canonicalFacts: OrganizationalGovernanceCanonicalFactReadPort = {
  getBusinessRole: (id) => id === "role-1" ? { id, title: "Role" } : undefined,
  getExpertise: (id) => id === "expertise-1" ? { id, title: "Expertise" } : undefined
};

function assignment(
  id: string,
  entityType: "PERSON" | "UNIT",
  entityId: string,
  role: "OWNER" | "EXECUTOR" | "COLLABORATOR" = "OWNER",
  overrides: Partial<ContextProgramAssignment> = {}
): ContextProgramAssignment {
  return {
    id,
    entityType,
    entityId,
    displayName: entityId,
    role,
    responsibilityType: role === "COLLABORATOR" ? "SUPPORT" : "PRIMARY",
    programEntityId: "G10-O01-A01-T001",
    planYear: 1405,
    ...overrides
  };
}

function context(overrides: Partial<OrganizationalContext> = {}): OrganizationalContext {
  return {
    subject: { type: "PERSON", id: "person-1" },
    person: { status: "KNOWN", value: people[0] },
    position: { status: "KNOWN", value: positions[0] },
    unit: { status: "KNOWN", value: units[0] },
    positions: positions,
    people: people,
    businessRoles: [] as BusinessRole[],
    expertise: [] as Expertise[],
    assignments: [],
    historicalEvidence: [],
    unresolvedReferences: [],
    provenance: [],
    authorizationScope: { scope: "COMPANY", subjectVisible: true },
    generatedAt: "2026-08-19T00:00:00.000Z",
    ...overrides
  };
}

function result(
  overrides: Partial<OrganizationalContext> = {},
  assignments: ContextProgramAssignment[] = [assignment("a1", "PERSON", "person-1")]
) {
  return evaluateOrganizationalGovernance({
    snapshot: createOrganizationalContextSnapshot(context(overrides)),
    identity,
    assignments
  });
}

describe("10C Organizational Governance", () => {
  it("passes canonical Person, Position, Unit and valid owner/executor/collaborator targets", () => {
    const output = result({}, [
      assignment("owner", "PERSON", "person-1", "OWNER"),
      assignment("executor", "PERSON", "person-1", "EXECUTOR"),
      assignment("collaborator", "UNIT", "it", "COLLABORATOR")
    ]);
    expect(output.status).toBe("PASS");
  });

  it("blocks unresolved and ambiguous identities without resolving them", () => {
    const output = result({
      unresolvedReferences: [{
        entityType: "PERSON",
        externalId: "unknown",
        sourceLabel: "Normalized Name",
        normalizedLabel: "Normalized Name",
        resolutionStatus: "CANDIDATE"
      }]
    }, [assignment("unknown", "PERSON", "unknown")]);
    expect(output.status).toBe("BLOCKED");
    expect(output.findings.some((item) => item.ruleId === "identity.unresolved")).toBe(true);
    expect(output.findings.some((item) => item.ruleId === "assignment.person.canonical")).toBe(true);
  });

  it("blocks inactive assignment targets", () => {
    const output = result({}, [
      assignment("inactive-person", "PERSON", "inactive-person"),
      assignment("inactive-unit", "UNIT", "inactive-unit", "COLLABORATOR")
    ]);
    expect(output.findings.filter((item) => item.ruleId === "assignment.target.inactive")).toHaveLength(2);
  });

  it("blocks missing and contradictory Person → Position → Unit relationships", () => {
    const missing = result({
      person: { status: "KNOWN", value: people[2] },
      position: { status: "MISSING", reason: "POSITION_NOT_FOUND" }
    });
    expect(missing.findings.some((item) => item.ruleId === "organization.person-position.missing")).toBe(true);

    const contradictory = result({
      person: { status: "KNOWN", value: { ...people[0], positionId: "rnd-position" } },
      position: { status: "KNOWN", value: positions[0] },
      unit: { status: "KNOWN", value: units[0] }
    });
    expect(contradictory.findings.some((item) => item.ruleId === "organization.person-position.contradictory")).toBe(true);

    const positionUnit = result({
      position: { status: "KNOWN", value: { ...positions[0], unitId: "rnd" } }
    });
    expect(positionUnit.findings.some((item) => item.ruleId === "organization.position-unit.contradictory")).toBe(true);
    expect(positionUnit.findings.some((item) => item.ruleId === "organization.person-unit.derived-contradictory")).toBe(true);
  });

  it("blocks partial required context and canonical-port relationship contradictions", () => {
    const partial = result({
      position: { status: "MISSING", reason: "POSITION_NOT_FOUND" },
      unit: { status: "MISSING", reason: "UNIT_NOT_DERIVED" }
    });
    expect(partial.status).toBe("BLOCKED");
    expect(partial.findings.map((item) => item.ruleId)).toEqual(expect.arrayContaining([
      "context.position.missing",
      "context.unit.missing"
    ]));

    const contradictoryIdentity: OrganizationalGovernanceIdentityReadPort = {
      ...identity,
      getPerson: (id) => id === "person-1" ? { ...people[0], positionId: "rnd-position" } : identity.getPerson(id),
      getPosition: (id) => id === "it-position" ? { ...positions[0], unitId: "rnd" } : identity.getPosition(id)
    };
    const output = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context()),
      identity: contradictoryIdentity,
      assignments: [assignment("a1", "PERSON", "person-1")]
    });
    expect(output.findings.map((item) => item.ruleId)).toEqual(expect.arrayContaining([
      "organization.person-position.canonical-contradictory",
      "organization.position-unit.canonical-contradictory",
      "organization.person-unit.canonical-contradictory"
    ]));
  });

  it("checks inactive Position and Unit identities", () => {
    const output = result({
      position: { status: "KNOWN", value: { ...positions[0], status: "INACTIVE" } },
      unit: { status: "KNOWN", value: { ...units[0], status: "INACTIVE" } }
    });
    expect(output.findings.filter((item) => item.ruleId === "identity.inactive")).toHaveLength(3);
  });

  it("blocks owner/executor unit inconsistency and preserves collaborator type semantics", () => {
    const output = result({}, [
      assignment("owner-rnd", "PERSON", "person-rnd", "OWNER"),
      assignment("executor-rnd", "PERSON", "person-rnd", "EXECUTOR"),
      assignment("collaborator-it", "UNIT", "it", "COLLABORATOR")
    ]);
    const withContext = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context()),
      identity,
      assignments: [
        assignment("owner-rnd", "PERSON", "person-rnd", "OWNER"),
        assignment("executor-rnd", "PERSON", "person-rnd", "EXECUTOR"),
        assignment("collaborator-it", "UNIT", "it", "COLLABORATOR")
      ],
      assignmentContexts: {
        "owner-rnd": {
          person: { status: "KNOWN", value: people[1] },
          position: { status: "KNOWN", value: positions[1] },
          unit: { status: "KNOWN", value: units[0] },
          authorizationScope: { scope: "COMPANY", subjectVisible: true }
        },
        "executor-rnd": {
          person: { status: "KNOWN", value: people[1] },
          position: { status: "KNOWN", value: positions[1] },
          unit: { status: "KNOWN", value: units[0] },
          authorizationScope: { scope: "COMPANY", subjectVisible: true }
        }
      }
    });
    expect(output.status).toBe("BLOCKED");
    expect(output.findings.filter((item) => item.ruleId === "assignment.context.required")).toHaveLength(2);
    expect(withContext.findings.filter((item) => item.ruleId === "assignment.organization.unit.contradictory")).toHaveLength(2);
    expect(withContext.status).toBe("BLOCKED");
  });

  it("blocks invalid PERSON/UNIT target types and missing organizational relationships", () => {
    const invalid = result({}, [
      assignment("bad-type", "PERSON", "it" as string, "OWNER")
    ]);
    expect(invalid.status).toBe("BLOCKED");

    const missing = result({}, [assignment("unassigned", "PERSON", "unassigned", "OWNER")]);
    expect(missing.findings.some((item) => item.ruleId === "assignment.organization.position.missing")).toBe(true);
  });

  it("isolates historical plan-year data and requires imported provenance", () => {
    const historical = result({}, [
      assignment("historical-year", "PERSON", "person-1", "OWNER", { planYear: 1404 }),
      assignment("historical-source", "PERSON", "person-1", "OWNER", {
        provenance: {
          workbook: "history.xlsx",
          sheet: "Organization",
          row: 1,
          column: "A",
          cell: "A1",
          sourceYear: 1404
        }
      })
    ]);
    expect(historical.findings.some((item) => item.ruleId === "plan-year.assignment.not-canonical")).toBe(true);
    expect(historical.findings.some((item) => item.ruleId === "plan-year.historical-assignment.blocked")).toBe(true);

    const imported = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context()),
      identity,
      assignments: [assignment("imported", "PERSON", "person-1")],
      assignmentOrigins: { imported: "IMPORTED" }
    });
    expect(imported.findings.some((item) => item.ruleId === "provenance.imported.required")).toBe(true);
  });

  it("governs historicalEvidence directly without deleting its provenance", () => {
    const historical = {
      workbook: "history.xlsx",
      sheet: "Organization",
      row: 2,
      column: "B",
      cell: "B2",
      sourceYear: 1404
    };
    const leaking = {
      ...historical,
      sourceYear: 1405
    };
    const output = result({
      historicalEvidence: [{
        reference: leaking,
        entityType: "PERSON",
        entityId: "person-1",
        sourceOnly: true
      }]
    });
    expect(output.status).toBe("BLOCKED");
    expect(output.findings[0].evidence?.provenance?.[0]).toEqual(leaking);
    expect(result({ historicalEvidence: [{
      reference: historical,
      entityType: "PERSON",
      entityId: "person-1",
      sourceOnly: true
    }] }).status).toBe("PASS");
  });

  it("does not let historical source-only evidence satisfy missing canonical identity facts", () => {
    const output = result({
      person: { status: "MISSING", reason: "PERSON_NOT_FOUND" },
      position: { status: "MISSING", reason: "POSITION_NOT_DERIVED" },
      unit: { status: "MISSING", reason: "UNIT_NOT_DERIVED" },
      historicalEvidence: [{
        reference: {
          workbook: "history.xlsx",
          sheet: "Organization",
          row: 4,
          column: "A",
          cell: "A4",
          sourceYear: 1404
        },
        entityType: "PERSON",
        entityId: "person-1",
        sourceOnly: true
      }]
    });
    expect(output.status).toBe("BLOCKED");
    expect(output.findings.map((item) => item.ruleId)).toEqual(expect.arrayContaining([
      "context.person.missing",
      "context.position.missing",
      "context.unit.missing"
    ]));
    expect(output.findings.some((item) => item.evidence?.provenance?.[0]?.sourceYear === 1404)).toBe(false);
  });

  it("keeps historical Position and Unit evidence source-only for partial canonical contexts", () => {
    const positionHistorical = result({
      position: { status: "MISSING", reason: "POSITION_NOT_FOUND" },
      historicalEvidence: [{
        reference: { workbook: "history.xlsx", sheet: "Organization", row: 5, column: "A", cell: "A5", sourceYear: 1404 },
        entityType: "POSITION",
        entityId: "it-position",
        sourceOnly: true
      }]
    });
    const unitHistorical = result({
      unit: { status: "MISSING", reason: "UNIT_NOT_DERIVED" },
      historicalEvidence: [{
        reference: { workbook: "history.xlsx", sheet: "Organization", row: 6, column: "A", cell: "A6", sourceYear: 1404 },
        entityType: "UNIT",
        entityId: "it",
        sourceOnly: true
      }]
    });
    expect(positionHistorical.status).toBe("BLOCKED");
    expect(unitHistorical.status).toBe("BLOCKED");
    expect(positionHistorical.findings.some((item) => item.ruleId === "context.position.missing")).toBe(true);
    expect(unitHistorical.findings.some((item) => item.ruleId === "context.unit.missing")).toBe(true);
  });

  it("does not treat normalization as identity resolution or inferred facts as canonical", () => {
    const normalizedOnly = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context()),
      identity,
      assignments: [assignment("normalized", "PERSON", "normalized-name")],
      assignmentOrigins: { normalized: "UNRESOLVED" }
    });
    expect(normalizedOnly.status).toBe("BLOCKED");
    expect(normalizedOnly.findings.some((item) => item.ruleId === "assignment.person.canonical")).toBe(true);

    const inferred = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context()),
      identity,
      assignments: [assignment("inferred", "PERSON", "person-1")],
      assignmentOrigins: { inferred: "INFERRED" }
    });
    expect(inferred.findings.some((item) => item.ruleId === "provenance.inferred.not-canonical")).toBe(true);
    expect(inferred.findings.some((item) => item.subject.type === "BUSINESS_ROLE")).toBe(false);
    expect(inferred.findings.some((item) => item.subject.type === "EXPERTISE")).toBe(false);
  });

  it("does not accept BusinessRole or Expertise without explicit canonical origin", () => {
    const output = result({
      businessRoles: [{ id: "role-1", title: "Role" }] as BusinessRole[],
      expertise: [{ id: "expertise-1", title: "Expertise" }] as Expertise[]
    });
    expect(output.findings.map((item) => item.ruleId)).toEqual(expect.arrayContaining([
      "identity.business-role.canonical-source",
      "identity.expertise.canonical-source"
    ]));
    expect(output.status).toBe("BLOCKED");
  });

  it("requires approved canonical authority for BusinessRole and Expertise", () => {
    const facts = {
      businessRoles: [{ id: "role-1", title: "Role" }] as BusinessRole[],
      expertise: [{ id: "expertise-1", title: "Expertise" }] as Expertise[]
    };
    const callerOnly = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context(facts)),
      identity,
      assignments: [],
      identityOrigins: {
        "BUSINESS_ROLE:role-1": "CANONICAL",
        "EXPERTISE:expertise-1": "CANONICAL"
      }
    });
    expect(callerOnly.status).toBe("BLOCKED");
    const approved = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context(facts)),
      identity,
      canonicalAuthority: canonicalFacts,
      assignments: [],
      identityOrigins: {
        "BUSINESS_ROLE:role-1": "CANONICAL",
        "EXPERTISE:expertise-1": "CANONICAL"
      }
    });
    expect(approved.status).toBe("PASS");
    const unavailable = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context(facts)),
      identity,
      canonicalAuthority: {
        getBusinessRole: () => undefined,
        getExpertise: () => undefined
      },
      assignments: [],
      identityOrigins: {
        "BUSINESS_ROLE:role-1": "CANONICAL",
        "EXPERTISE:expertise-1": "CANONICAL"
      }
    });
    expect(unavailable.status).toBe("BLOCKED");
  });

  it("handles authorization unavailability, deterministic ordering, and deduplication", () => {
    const output = result({
      authorizationScope: {
        scope: "OWN",
        subjectVisible: false,
        reason: "OUTSIDE_AUTHORIZATION_SCOPE"
      }
    }, [
      assignment("unknown", "PERSON", "unknown"),
      assignment("unknown", "PERSON", "unknown")
    ]);
    expect(output.status).toBe("BLOCKED");
    expect(output.findings).toEqual([...output.findings].sort((left, right) =>
      left.ruleId.localeCompare(right.ruleId)
      || left.subject.type.localeCompare(right.subject.type)
      || (left.subject.id ?? "").localeCompare(right.subject.id ?? "")
      || left.reason.localeCompare(right.reason)
    ));
    expect(output.findings.filter((item) => item.ruleId === "assignment.person.canonical")).toHaveLength(1);
  });

  it("isolates assignment subjects when validating multiple organizational contexts", () => {
    const output = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context()),
      identity,
      assignments: [
        assignment("it-owner", "PERSON", "person-1", "OWNER"),
        assignment("rnd-owner", "PERSON", "person-rnd", "OWNER")
      ],
      assignmentContexts: {
        "it-owner": {
          person: { status: "KNOWN", value: people[0] },
          position: { status: "KNOWN", value: positions[0] },
          unit: { status: "KNOWN", value: units[0] },
          authorizationScope: { scope: "COMPANY", subjectVisible: true }
        },
        "rnd-owner": {
          person: { status: "KNOWN", value: people[1] },
          position: { status: "KNOWN", value: positions[1] },
          unit: { status: "KNOWN", value: units[1] },
          authorizationScope: { scope: "COMPANY", subjectVisible: true }
        }
      }
    });
    expect(output.findings.some((item) => item.ruleId === "assignment.organization.unit.contradictory")).toBe(false);
  });

  it("uses the root context only for a matching single-subject assignment", () => {
    const output = result({}, [assignment("root-owner", "PERSON", "person-1", "OWNER")]);
    expect(output.status).toBe("PASS");
    expect(output.findings.some((item) => item.ruleId === "assignment.context.required")).toBe(false);
  });

  it("blocks unrelated OWNER/EXECUTOR assignments when assignment-specific context is absent", () => {
    const output = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context()),
      identity,
      assignments: [
        assignment("rnd-owner", "PERSON", "person-rnd", "OWNER"),
        assignment("rnd-executor", "PERSON", "person-rnd", "EXECUTOR")
      ]
    });
    expect(output.status).toBe("BLOCKED");
    expect(output.findings.filter((item) => item.ruleId === "assignment.context.required")).toHaveLength(2);
    expect(output.findings.some((item) => item.ruleId === "assignment.organization.unit.contradictory")).toBe(false);
  });

  it("evaluates separate assignment contexts independently", () => {
    const output = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context()),
      identity,
      assignments: [
        assignment("it-owner", "PERSON", "person-1", "OWNER"),
        assignment("rnd-owner", "PERSON", "person-rnd", "OWNER")
      ],
      assignmentContexts: {
        "rnd-owner": {
          person: { status: "KNOWN", value: people[1] },
          position: { status: "KNOWN", value: positions[1] },
          unit: { status: "KNOWN", value: units[1] },
          authorizationScope: { scope: "COMPANY", subjectVisible: true }
        }
      }
    });
    expect(output.findings.some((item) => item.ruleId === "assignment.context.required")).toBe(false);
    expect(output.status).toBe("PASS");
  });

  it("blocks invisible, incomplete, and contradictory assignment contexts", () => {
    const base: Pick<OrganizationalContext, "person" | "position" | "unit" | "authorizationScope"> = {
      person: { status: "KNOWN", value: people[1] },
      position: { status: "KNOWN", value: positions[1] },
      unit: { status: "KNOWN", value: units[1] },
      authorizationScope: { scope: "COMPANY" as const, subjectVisible: true }
    };
    const invisible = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context()),
      identity,
      assignments: [assignment("rnd-owner", "PERSON", "person-rnd", "OWNER")],
      assignmentContexts: { "rnd-owner": { ...base, authorizationScope: { scope: "COMPANY", subjectVisible: false } } }
    });
    expect(invisible.status).toBe("BLOCKED");
    expect(invisible.findings.some((item) => item.ruleId === "assignment.context.authorization.unavailable")).toBe(true);

    const incomplete = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context()),
      identity,
      assignments: [assignment("rnd-owner", "PERSON", "person-rnd", "OWNER")],
      assignmentContexts: {
        "rnd-owner": {
          ...base,
          position: { status: "MISSING", reason: "UNAVAILABLE" }
        }
      }
    });
    expect(incomplete.status).toBe("BLOCKED");
    expect(incomplete.findings.some((item) => item.ruleId === "assignment.context.position.unavailable")).toBe(true);

    const contradictory = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context()),
      identity,
      assignments: [assignment("rnd-owner", "PERSON", "person-rnd", "OWNER")],
      assignmentContexts: {
        "rnd-owner": {
          ...base,
          position: { status: "KNOWN", value: { ...positions[1], unitId: "it" } }
        }
      }
    });
    expect(contradictory.status).toBe("BLOCKED");
    expect(contradictory.findings.some((item) => item.ruleId === "organization.position-unit.contradictory")).toBe(true);
  });

  it("binds assignment-specific contexts to exact Person and Unit targets", () => {
    const personContext = {
      person: { status: "KNOWN" as const, value: people[1] },
      position: { status: "KNOWN" as const, value: positions[1] },
      unit: { status: "KNOWN" as const, value: units[1] },
      authorizationScope: { scope: "COMPANY" as const, subjectVisible: true }
    };
    const personMismatch = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context()),
      identity,
      assignments: [assignment("person-a", "PERSON", "person-1", "OWNER")],
      assignmentContexts: { "person-a": personContext }
    });
    expect(personMismatch.status).toBe("BLOCKED");
    expect(personMismatch.findings.some((item) => item.ruleId === "assignment.context.identity.mismatch")).toBe(true);

    const personMatch = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context()),
      identity,
      assignments: [assignment("person-a", "PERSON", "person-rnd", "OWNER")],
      assignmentContexts: { "person-a": personContext }
    });
    expect(personMatch.status).toBe("PASS");

    const unitMismatch = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context()),
      identity,
      assignments: [assignment("unit-a", "UNIT", "it", "OWNER")],
      assignmentContexts: { "unit-a": { ...personContext, unit: { status: "KNOWN", value: units[1] } } }
    });
    expect(unitMismatch.status).toBe("BLOCKED");
    expect(unitMismatch.findings.some((item) => item.ruleId === "assignment.context.identity.mismatch")).toBe(true);

    const unitMatch = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context()),
      identity,
      assignments: [assignment("unit-a", "UNIT", "rnd", "OWNER")],
      assignmentContexts: { "unit-a": { ...personContext, unit: { status: "KNOWN", value: units[1] } } }
    });
    expect(unitMatch.status).toBe("PASS");
  });

  it("aggregates WARNING and PASS deterministically", () => {
    const warning = evaluateOrganizationalGovernance({
      snapshot: createOrganizationalContextSnapshot(context()),
      identity,
      assignments: [assignment("manual", "PERSON", "person-1")],
      assignmentOrigins: { manual: "MANUAL" }
    });
    expect(warning.status).toBe("WARNING");
    expect(warning.findings.some((item) => item.ruleId === "provenance.manual.review")).toBe(true);
    expect(result({}, []).status).toBe("PASS");
  });
});
