import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { beforeEach, describe, expect, it } from "vitest";
import { programFixture } from "../../domain/program/program.fixture";
import type { Person, Position, Unit } from "../../domain/organization";
import type { OrganizationalContext } from "../organization/OrganizationalContext";
import type { ContextProgramAssignment } from "../organization/OrganizationalContext";
import { createOrganizationalContextSnapshot } from "../organization/OrganizationalContextHardening";
import { ProductionOrganizationalGovernance } from "../organization/governance/ProductionOrganizationalGovernance";
import { GovernedProgramEvaluationService } from "../program/GovernedProgramEvaluationService";
import { closeDatabase } from "../../server/db";
import { seedBaseline } from "../../server/seed";
import type { SessionUser } from "../../server/auth";
import { createGovernedPdfBuffer, createGovernedXlsxBuffer } from "../../server/exporters";
import {
  GovernedOperationalReportAdapter,
  ProductionGovernedOperationalReportService,
  type GovernedOperationalReportInput
} from "./index";

const unit: Unit = { id: "unit-it", name: "IT", status: "ACTIVE" };
const position: Position = { id: "position-it", title: "IT", unitId: unit.id };
const person: Person = { id: "person-1", fullName: "Person One", status: "ACTIVE", positionId: position.id };
const user: SessionUser = {
  id: "user-1",
  username: "user-1",
  role: "MANAGEMENT",
  scope: "COMPANY"
};

const identity = {
  getPerson: (id: string) => id === person.id ? person : undefined,
  getPosition: (id: string) => id === position.id ? position : undefined,
  getUnit: (id: string) => id === unit.id ? unit : undefined
};

function snapshot(overrides: Partial<OrganizationalContext> = {}) {
  const context: OrganizationalContext = {
    subject: { type: "PROGRAM_ENTITY", id: "program-1405" },
    person: { status: "MISSING", reason: "NOT_REQUIRED" },
    position: { status: "MISSING", reason: "NOT_REQUIRED" },
    unit: { status: "MISSING", reason: "NOT_REQUIRED" },
    positions: [position],
    people: [person],
    businessRoles: [],
    expertise: [],
    assignments: [],
    historicalEvidence: [],
    unresolvedReferences: [],
    provenance: [{
      kind: "ASSIGNMENT",
      sourceOnly: false,
      reference: {
        workbook: "plan.xlsx",
        sheet: "1405",
        row: 2,
        column: "A",
        cell: "A2",
        sourceYear: 1405
      }
    }],
    authorizationScope: { scope: user.scope, subjectVisible: true },
    generatedAt: "2026-08-19T00:00:00.000Z",
    ...overrides
  };
  return createOrganizationalContextSnapshot(context);
}

function evaluate(program = structuredClone(programFixture), context = snapshot()) {
  const assignmentContexts: Record<string, Pick<OrganizationalContext, "person" | "position" | "unit" | "authorizationScope">> = {};
  for (const goal of program.goals) {
    for (const objective of goal.objectives) {
      for (const activity of objective.activities) {
        for (const entity of [activity, ...activity.actions]) {
          for (const assignment of entity.assignments) {
            assignmentContexts[assignment.id] = {
              person: { status: "KNOWN", value: person },
              position: { status: "KNOWN", value: position },
              unit: { status: "KNOWN", value: unit },
              authorizationScope: { scope: user.scope, subjectVisible: true }
            };
          }
        }
      }
    }
  }
  return new GovernedProgramEvaluationService().evaluate({
    program,
    organizationalGovernance: {
      boundary: new ProductionOrganizationalGovernance({
        listBusinessRoles: () => [],
        listExpertise: () => []
      }),
      input: { snapshot: context, identity, assignmentContexts }
    },
    evaluationGeneratedAt: "2026-08-19T00:00:00.000Z",
    today: "2026-08-19"
  });
}

function input(overrides: Partial<GovernedOperationalReportInput> = {}): GovernedOperationalReportInput {
  return {
    governedEvaluation: evaluate(),
    organizationalContext: snapshot(),
    authorization: user,
    generatedAt: "2026-08-19T00:00:00.000Z",
    ...overrides
  };
}

function cleanProgram() {
  const program = structuredClone(programFixture);
  program.priority = "متوسط";
  for (const goal of program.goals) {
    goal.priority = "متوسط";
    for (const objective of goal.objectives) {
      objective.priority = "متوسط";
      for (const activity of objective.activities) {
        activity.priority = "متوسط";
        activity.assignments = [];
        for (const action of activity.actions) {
          action.priority = "متوسط";
          action.assignments = [];
        }
      }
    }
  }
  return program;
}

describe("10E GovernedOperationalReportAdapter", () => {
  it("projects a canonical 1405 PASS report", () => {
    const program = cleanProgram();
    program.goals[0].objectives[0].activities[0].assignments = [{
      id: "eligible-assignment",
      entityType: "PERSON",
      entityId: person.id,
      displayName: person.fullName,
      role: "OWNER",
      responsibilityType: "PRIMARY"
    }];
    program.goals[0].objectives[0].activities[0].actions[0].assignments = [{
      id: "eligible-action-assignment",
      entityType: "PERSON",
      entityId: person.id,
      displayName: person.fullName,
      role: "EXECUTOR",
      responsibilityType: "PRIMARY"
    }];
    const report = new GovernedOperationalReportAdapter().project(input({
      governedEvaluation: evaluate(program)
    }));

    expect(report.planYear).toBe(1405);
    expect(report.evaluationState).toBe("PASS");
    expect(report.eligibleAssignmentIds).toEqual(["eligible-action-assignment", "eligible-assignment"]);
    expect(report.summary.eligibleAssignments).toBe(2);
  });

  it("preserves WARNING and BLOCKED states distinctly", () => {
    const warningProgram = cleanProgram();
    warningProgram.goals[0].objectives[0].activities[0].priority = "بحرانی";
    warningProgram.goals[0].objectives[0].activities[0].assignments = [{
      id: "warning-assignment",
      entityType: "PERSON",
      entityId: person.id,
      displayName: person.fullName,
      role: "OWNER",
      responsibilityType: "PRIMARY"
    }];
    warningProgram.goals[0].objectives[0].activities[0].actions[0].assignments = [{
      id: "warning-action-assignment",
      entityType: "PERSON",
      entityId: person.id,
      displayName: person.fullName,
      role: "EXECUTOR",
      responsibilityType: "PRIMARY"
    }];
    const warning = new GovernedOperationalReportAdapter().project(input({
      governedEvaluation: evaluate(warningProgram)
    }));
    expect(warning.evaluationState).toBe("WARNING");

    const blockedProgram = cleanProgram();
    blockedProgram.goals[0].objectives[0].activities[0].assignments = [{
      id: "blocked-assignment",
      entityType: "PERSON",
      entityId: "unknown",
      displayName: "Unknown",
      role: "OWNER",
      responsibilityType: "PRIMARY"
    }];
    const blocked = new GovernedOperationalReportAdapter().project(input({
      governedEvaluation: evaluate(blockedProgram)
    }));
    expect(blocked.evaluationState).toBe("BLOCKED");
    expect(blocked.eligibleAssignmentIds).toEqual([]);
  });

  it("keeps non-assignment blockers from becoming successful canonical coverage", () => {
    const context = snapshot({ businessRoles: [{ id: "role-1", title: "Unverified" }] });
    const result = evaluate(cleanProgram(), context);
    const report = new GovernedOperationalReportAdapter().project(input({
      governedEvaluation: result,
      organizationalContext: context
    }));
    expect(report.evaluationState).toBe("BLOCKED");
    expect(report.summary.eligibleAssignments).toBe(0);
    expect(report.findings.some((finding) => finding.ruleId === "identity.business-role.canonical-source")).toBe(true);
  });

  it("filters scoped report subjects using eligible governed assignments", () => {
    const program = cleanProgram();
    const activity = program.goals[0].objectives[0].activities[0];
    activity.assignments = [{
      id: "scoped-assignment",
      entityType: "PERSON",
      entityId: person.id,
      displayName: person.fullName,
      role: "OWNER",
      responsibilityType: "PRIMARY"
    }];
    const scopedUser: SessionUser = { ...user, scope: "OWN", person_id: person.id };
    const report = new GovernedOperationalReportAdapter().project(input({
      governedEvaluation: evaluate(program),
      authorization: scopedUser
    }));
    expect(report.rows.some((row) => row.id === activity.id)).toBe(true);
  });

  it("keeps historical evidence out of current summaries and preserves provenance", () => {
    const historical = {
      reference: {
        workbook: "archive.xlsx",
        sheet: "1404",
        row: 4,
        column: "B",
        cell: "B4",
        sourceYear: 1404
      },
      entityType: "PERSON" as const,
      entityId: person.id,
      sourceOnly: true as const
    };
    const context = snapshot({
      historicalEvidence: [historical],
      assignments: [{
        id: "context-assignment",
        entityType: "PERSON",
        entityId: person.id,
        displayName: person.fullName,
        role: "OWNER",
        responsibilityType: "PRIMARY",
        programEntityId: "program-1405",
        planYear: 1405,
        provenance: {
          workbook: "plan.xlsx",
          sheet: "1405",
          row: 2,
          column: "A",
          cell: "A2",
          sourceYear: 1405
        }
      } as ContextProgramAssignment]
    });
    const report = new GovernedOperationalReportAdapter().project(input({
      organizationalContext: context
    }));
    expect(report.summary.eligibleAssignments).toBe(0);
    expect(report.historicalEvidence).toEqual([historical]);
    expect(report.provenance.some((item) => item.reference.sourceYear === 1405)).toBe(true);
  });

  it("preserves unresolved references and explicitly classifies legacy metrics", () => {
    const context = snapshot({
      unresolvedReferences: [{
        entityType: "PERSON",
        externalId: "legacy-person",
        sourceLabel: "Legacy Person",
        resolutionStatus: "UNKNOWN"
      }]
    });
    const report = new GovernedOperationalReportAdapter().project(input({
      organizationalContext: context,
      legacyCompatibilityMetrics: [{
        name: "legacyAverageProgress",
        value: 72,
        source: "legacy-reporting",
        compatibilityStatus: "LEGACY_NON_GOVERNED",
        governed: false
      }]
    }));
    expect(report.unresolvedReferences[0].resolutionStatus).toBe("UNKNOWN");
    expect(report.legacyCompatibilityMetrics[0]).toMatchObject({
      compatibilityStatus: "LEGACY_NON_GOVERNED",
      governed: false
    });
  });

  it("is deterministic with stable findings and assignment ordering", () => {
    const program = cleanProgram();
    program.goals[0].objectives[0].activities[0].assignments = [
      {
        id: "z-assignment",
        entityType: "PERSON",
        entityId: person.id,
        displayName: person.fullName,
        role: "OWNER",
        responsibilityType: "PRIMARY"
      },
      {
        id: "a-assignment",
        entityType: "PERSON",
        entityId: person.id,
        displayName: person.fullName,
        role: "COLLABORATOR",
        responsibilityType: "SUPPORT"
      }
    ];
    const adapter = new GovernedOperationalReportAdapter();
    const first = adapter.project(input({ governedEvaluation: evaluate(program) }));
    const second = adapter.project(input({ governedEvaluation: evaluate(program) }));
    expect(first).toEqual(second);
    expect(first.eligibleAssignmentIds).toEqual(["a-assignment", "z-assignment"]);
    expect(first.findings.map((finding) => finding.ruleId)).toEqual(
      [...first.findings].sort((left, right) => left.ruleId.localeCompare(right.ruleId)).map((finding) => finding.ruleId)
    );
  });

  it("renders equivalent governed facts to XLSX and PDF", async () => {
    const report = new GovernedOperationalReportAdapter().project(input());
    const workbook = createGovernedXlsxBuffer(report);
    const pdf = await createGovernedPdfBuffer(report);
    expect(XLSX.read(workbook, { type: "buffer" }).SheetNames).toEqual([
      "گزارش حاکمیتی",
      "یافته‌های حاکمیتی"
    ]);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(report.summary.qualityScore).toBeGreaterThanOrEqual(0);
  });
});

describe("10E production composition", () => {
  let databasePath = "";

  beforeEach(() => {
    closeDatabase();
    databasePath = path.join(os.tmpdir(), `pulse-10e-${Date.now()}-${Math.random()}.sqlite`);
    process.env.PULSE_DB_PATH = databasePath;
    seedBaseline();
    closeDatabase();
  });

  it("uses the production 10D evaluator without mutating SQLite", () => {
    const before = createHash("sha256").update(fs.readFileSync(databasePath)).digest("hex");
    const result = new ProductionGovernedOperationalReportService().report(
      structuredClone(programFixture),
      user,
      "2026-08-19T00:00:00.000Z"
    );
    const after = createHash("sha256").update(fs.readFileSync(databasePath)).digest("hex");
    const database = new Database(databasePath, { readonly: true });
    const schema = database.prepare("SELECT type, name, sql FROM sqlite_master ORDER BY type, name").all();
    database.close();

    expect(result.planYear).toBe(1405);
    expect(result.generatedAt).toBe("2026-08-19T00:00:00.000Z");
    expect(after).toBe(before);
    expect(schema.length).toBeGreaterThan(0);
  });
});
