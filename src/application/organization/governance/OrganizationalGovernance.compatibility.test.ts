import { describe, expect, it } from "vitest";
import type { Person, Position, Unit } from "../../../domain/organization";
import type { ContextProgramAssignment, OrganizationalContext } from "../OrganizationalContext";
import { createOrganizationalContextSnapshot } from "../OrganizationalContextHardening";
import {
  evaluateOrganizationalGovernance,
  type OrganizationalGovernanceIdentityReadPort
} from "./OrganizationalGovernance";
import { assessProgramResponsibilities } from "../../../domain/program/governance/ResponsibilityAssessment";
import { createGovernanceReport } from "../../../domain/program/governance/GovernanceViolation";
import { programFixture } from "../../../domain/program/program.fixture";
import type { Assignment } from "../../../domain/program/Assignment";
import type { Program } from "../../../domain/program/types";
import { ProgramQualityScoreEngine } from "../../../domain/program/quality/ProgramQualityScoreEngine";
import { ProgramGovernanceRules } from "../../../domain/program/governance/ProgramGovernanceRules";
import { projectProgramThroughOrganizationalGovernance } from "./ProgramGovernanceGate";
import { ProductionOrganizationalGovernance } from "./ProductionOrganizationalGovernance";
import { ImportReviewService } from "../../import/staging/ImportReviewService";
import type { ImportSource } from "../../import/contracts";

const unit: Unit = { id: "unit-it", name: "IT", status: "ACTIVE" };
const position: Position = { id: "position-it", title: "IT", unitId: unit.id };
const person: Person = { id: "person-1", fullName: "Person One", status: "ACTIVE", positionId: position.id };

const identity: OrganizationalGovernanceIdentityReadPort = {
  getPerson: (id) => id === person.id ? person : undefined,
  getPosition: (id) => id === position.id ? position : undefined,
  getUnit: (id) => id === unit.id ? unit : undefined
};

function snapshot(): ReturnType<typeof createOrganizationalContextSnapshot> {
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

function contextAssignment(id: string, entityId: string, role: ContextProgramAssignment["role"] = "EXECUTOR"): ContextProgramAssignment {
  return {
    id,
    entityType: "PERSON",
    entityId,
    displayName: entityId,
    role,
    responsibilityType: "PRIMARY",
    programEntityId: "action-firewall",
    planYear: 1405
  };
}

function programWithAssignments(assignments: Assignment[]): Program {
  return programWithActivityAndAction(assignments[0] ? [assignments[0]] : [], assignments[1] ? [assignments[1]] : []);
}

function programWithActivityAndAction(activityAssignments: Assignment[], actionAssignments: Assignment[]): Program {
  const program = structuredClone(programFixture);
  const activity = program.goals[0].objectives[0].activities[0];
  const action = activity.actions[0];
  activity.assignments = activityAssignments;
  action.assignments = actionAssignments;
  return program;
}

function canonicalAssignments(
  assignments: ContextProgramAssignment[],
  blockedIds: Set<string>
): Assignment[] {
  return assignments
    .filter((assignment) => !blockedIds.has(assignment.id))
    .map(({ id, entityType, entityId, displayName, role, responsibilityType }) => ({
      id, entityType, entityId, displayName, role, responsibilityType
    }));
}

function blockedAssignmentIds(assignments: ContextProgramAssignment[]): Set<string> {
  return new Set(assignments
    .filter((assignment) => evaluateOrganizationalGovernance({
      snapshot: snapshot(),
      identity,
      assignments: [assignment]
    }).status === "BLOCKED")
    .map((assignment) => assignment.id));
}

describe("10C compatibility boundaries", () => {
  it("excludes 10C-blocked assignments from responsibility coverage", () => {
    const valid = [contextAssignment("activity-valid", person.id), contextAssignment("action-valid", person.id)];
    const validResult = evaluateOrganizationalGovernance({
      snapshot: snapshot(),
      identity,
      assignments: valid
    });
    expect(validResult.status).toBe("PASS");

    const invalid = [contextAssignment("activity-invalid", "unknown"), contextAssignment("action-valid", person.id)];
    const invalidResult = evaluateOrganizationalGovernance({
      snapshot: snapshot(),
      identity,
      assignments: invalid
    });
    expect(invalidResult.status).toBe("BLOCKED");

    const validAssessment = assessProgramResponsibilities(programWithAssignments(canonicalAssignments(valid, new Set())), {
      requireCriticalCollaboration: false
    });
    const gatedAssessment = assessProgramResponsibilities(programWithActivityAndAction(
      [],
      canonicalAssignments([invalid[1]], new Set())
    ), { requireCriticalCollaboration: false });

    expect(validAssessment).toEqual([]);
    expect(gatedAssessment).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ACTIVITY_WITHOUT_RESPONSIBLE_EXECUTOR" })
    ]));
  });

  it("keeps normal scoring unchanged and cannot turn a 10C BLOCKED result into valid coverage", () => {
    const validAssignments = [contextAssignment("activity-valid", person.id), contextAssignment("action-valid", person.id)];
    const validProgram = programWithAssignments(canonicalAssignments(validAssignments, new Set()));
    const engine = new ProgramQualityScoreEngine();
    const validScore = engine.calculate(
      validProgram,
      createGovernanceReport(),
      assessProgramResponsibilities(validProgram, { requireCriticalCollaboration: false }),
      { generatedAt: "2026-08-19T00:00:00.000Z" }
    );
    expect(validScore.dimensions.responsibility).toBe(100);

    const sourceProgram = programWithAssignments([
      contextAssignment("activity-invalid", "unknown") as unknown as Assignment,
      contextAssignment("action-valid", person.id) as unknown as Assignment
    ]);
    const gated = projectProgramThroughOrganizationalGovernance(sourceProgram, {
      snapshot: snapshot(),
      identity
    });
    expect(gated.governance.status).toBe("BLOCKED");
    const gatedScore = engine.calculate(
      gated.program,
      createGovernanceReport(),
      assessProgramResponsibilities(gated.program, { requireCriticalCollaboration: false }),
      { generatedAt: "2026-08-19T00:00:00.000Z" }
    );
    expect(gatedScore.dimensions.responsibility).toBeLessThan(validScore.dimensions.responsibility);
    expect(sourceProgram.goals[0].objectives[0].activities[0].assignments).toHaveLength(1);
  });

  it("preserves ProgramGovernanceRules and keeps blocked organizational assignments out of its downstream coverage", () => {
    const program = programWithAssignments([
      contextAssignment("activity-invalid", "unknown") as unknown as Assignment,
      contextAssignment("action-valid", person.id) as unknown as Assignment
    ]);
    const rules = new ProgramGovernanceRules();
    const baseline = rules.validateActivity(program.goals[0].objectives[0].activities[0]);
    const gated = projectProgramThroughOrganizationalGovernance(program, {
      snapshot: snapshot(),
      identity
    });
    const after = rules.validateActivity(gated.program.goals[0].objectives[0].activities[0]);
    expect(after.violations.map((item) => item.rule)).toEqual(baseline.violations.map((item) => item.rule));
    expect(gated.program.goals[0].objectives[0].activities[0].assignments).toHaveLength(0);
    expect(assessProgramResponsibilities(gated.program, { requireCriticalCollaboration: false }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: "ACTIVITY_WITHOUT_RESPONSIBLE_EXECUTOR" })]));
  });

  it("wires the actual ImportReviewService consumer through the production governance boundary", () => {
    const source: ImportSource = { type: "MANUAL", name: "10c-test", metadata: {} };
    const program = programWithAssignments([
      contextAssignment("activity-invalid", "unknown") as unknown as Assignment,
      contextAssignment("action-valid", person.id) as unknown as Assignment
    ]);
    const originalAssignments = structuredClone(program.goals[0].objectives[0].activities[0].assignments);
    const boundary = new ProductionOrganizationalGovernance({
      listBusinessRoles: () => [],
      listExpertise: () => []
    });
    const review = new ImportReviewService();
    const job = review.createJob(source, "10c-production");
    expect(() => review.analyze(job.id, program, {
      organizationalGovernance: {
        boundary,
        input: { snapshot: snapshot(), identity }
      }
    })).toThrow(/evaluateGoverned/);
    expect(program.goals[0].objectives[0].activities[0].assignments).toEqual(originalAssignments);
  });

  it("binds production canonical authority to the approved list-based boundary", () => {
    const facts = {
      businessRoles: [{ id: "role-1", title: "Role" }],
      expertise: [{ id: "expertise-1", title: "Expertise" }]
    };
    const roleContext = structuredClone(snapshot().context) as unknown as OrganizationalContext;
    const roleSnapshot = createOrganizationalContextSnapshot({
      ...roleContext,
      businessRoles: facts.businessRoles,
      expertise: facts.expertise
    });
    const boundary = new ProductionOrganizationalGovernance({
      listBusinessRoles: () => facts.businessRoles,
      listExpertise: () => facts.expertise
    });
    const approved = boundary.evaluateProgram(programWithAssignments([]), {
      snapshot: roleSnapshot,
      identity,
      identityOrigins: {
        "BUSINESS_ROLE:role-1": "CANONICAL",
        "EXPERTISE:expertise-1": "CANONICAL"
      }
    });
    expect(approved.governance.status).toBe("PASS");

    const callerAttempt = boundary.evaluateProgram(programWithAssignments([]), {
      snapshot: roleSnapshot,
      identity,
      identityOrigins: {
        "BUSINESS_ROLE:role-1": "CANONICAL",
        "EXPERTISE:expertise-1": "CANONICAL"
      },
      canonicalAuthority: {
        getBusinessRole: () => undefined,
        getExpertise: () => undefined
      } as never
    } as never);
    expect(callerAttempt.governance.status).toBe("PASS");
  });

  it("derives projection eligibility from one aggregate result, including non-assignment blockers", () => {
    const roleContext = structuredClone(snapshot().context) as unknown as OrganizationalContext;
    roleContext.businessRoles = [{ id: "role-1", title: "Unverified" }];
    const program = programWithAssignments([
      contextAssignment("activity-valid", person.id) as unknown as Assignment,
      contextAssignment("action-valid", person.id) as unknown as Assignment
    ]);
    const projected = projectProgramThroughOrganizationalGovernance(program, {
      snapshot: createOrganizationalContextSnapshot(roleContext),
      identity,
      identityOrigins: { "BUSINESS_ROLE:role-1": "CANONICAL" }
    });
    expect(projected.governance.status).toBe("BLOCKED");
    expect(projected.eligibleAssignmentIds.size).toBe(0);
    expect(projected.program.goals[0].objectives[0].activities[0].assignments).toHaveLength(0);
  });
});
