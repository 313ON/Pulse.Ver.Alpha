import { describe, expect, it } from "vitest";
import { programFixture } from "../../domain/program/program.fixture";
import type { Person, Position, Unit } from "../../domain/organization";
import type { OrganizationalContext } from "../organization/OrganizationalContext";
import { createOrganizationalContextSnapshot } from "../organization/OrganizationalContextHardening";
import { ProductionOrganizationalGovernance } from "../organization/governance/ProductionOrganizationalGovernance";
import { GovernedProgramEvaluationService } from "./GovernedProgramEvaluationService";

const unit: Unit = { id: "unit-it", name: "IT", status: "ACTIVE" };
const position: Position = { id: "position-it", title: "IT", unitId: unit.id };
const person: Person = { id: "person-1", fullName: "Person One", status: "ACTIVE", positionId: position.id };

const identity = {
  getPerson: (id: string) => id === person.id ? person : undefined,
  getPosition: (id: string) => id === position.id ? position : undefined,
  getUnit: (id: string) => id === unit.id ? unit : undefined
};

function snapshot() {
  const context: OrganizationalContext = {
    subject: { type: "PERSON", id: person.id },
    person: { status: "KNOWN", value: person },
    position: { status: "KNOWN", value: position },
    unit: { status: "KNOWN", value: unit },
    positions: [position],
    people: [person],
    businessRoles: [],
    expertise: [],
    assignments: [],
    historicalEvidence: [],
    unresolvedReferences: [],
    provenance: [],
    authorizationScope: { scope: "COMPANY", subjectVisible: true },
    generatedAt: "2026-08-19T00:00:00.000Z"
  };
  return createOrganizationalContextSnapshot(context);
}

function boundary() {
  return new ProductionOrganizationalGovernance({
    listBusinessRoles: () => [],
    listExpertise: () => []
  });
}

function evaluate(program = structuredClone(programFixture)) {
  const service = new GovernedProgramEvaluationService();
  return service.evaluate({
    program,
    organizationalGovernance: {
      boundary: boundary(),
      input: { snapshot: snapshot(), identity }
    }
  });
}

describe("10D governed program evaluation", () => {
  it("runs one governed orchestration and returns eligible canonical coverage", () => {
    const program = structuredClone(programFixture);
    const activity = program.goals[0].objectives[0].activities[0];
    activity.assignments = [{
      id: "activity-owner",
      entityType: "PERSON",
      entityId: person.id,
      displayName: person.fullName,
      role: "OWNER",
      responsibilityType: "PRIMARY"
    }];
    const before = structuredClone(program);
    const result = evaluate(program);
    expect(result.organizationalGovernance.status).toBe("PASS");
    expect(result.evaluationState).toBe("PASS");
    expect(result.eligibleAssignmentIds).toEqual(new Set(["activity-owner"]));
    expect(result.program.program.goals[0].objectives[0].activities[0].assignments).toHaveLength(1);
    expect(program).toEqual(before);
  });

  it("excludes a blocked assignment from responsibility and quality coverage", () => {
    const program = structuredClone(programFixture);
    program.goals[0].objectives[0].activities[0].assignments = [{
      id: "blocked-owner",
      entityType: "PERSON",
      entityId: "unknown",
      displayName: "Unknown",
      role: "OWNER",
      responsibilityType: "PRIMARY"
    }];
    const result = evaluate(program);
    expect(result.organizationalGovernance.status).toBe("BLOCKED");
    expect(result.eligibleAssignmentIds).toEqual(new Set());
    expect(result.program.program.goals[0].objectives[0].activities[0].assignments).toHaveLength(0);
    expect(result.assessment.some((item) => item.code === "ACTIVITY_WITHOUT_RESPONSIBLE_EXECUTOR")).toBe(true);
    expect(result.qualityScore.dimensions.responsibility).toBeLessThan(100);
  });

  it("is deterministic and preserves snapshot isolation in returned data", () => {
    const first = evaluate();
    const second = evaluate();
    expect(first.organizationalGovernance).toEqual(second.organizationalGovernance);
    expect([...first.eligibleAssignmentIds]).toEqual([...second.eligibleAssignmentIds]);
    const invalidProgram = structuredClone(programFixture);
    invalidProgram.goals[0].objectives[0].activities[0].assignments = [{
      id: "blocked-owner",
      entityType: "PERSON",
      entityId: "unknown",
      displayName: "Unknown",
      role: "OWNER",
      responsibilityType: "PRIMARY"
    }];
    const output = evaluate(invalidProgram);
    const originalSnapshot = snapshot();
    output.organizationalGovernance.findings[0].reason = "mutated";
    expect(originalSnapshot.context.authorizationScope.subjectVisible).toBe(true);
    expect(invalidProgram.goals[0].objectives[0].activities[0].assignments).toHaveLength(1);
  });
});
