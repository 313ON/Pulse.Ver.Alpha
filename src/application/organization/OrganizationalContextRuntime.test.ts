import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createOrganizationalContextSnapshot } from "./OrganizationalContextHardening";
import { OrganizationalContextBuilder } from "./OrganizationalContextBuilder";
import { closeDatabase } from "../../server/db";
import { seedBaseline } from "../../server/seed";
import { SQLiteOrganizationRepository } from "../../server/organization/OrganizationRepository";
import { SQLiteOrganizationalContextReadRepository } from "../../server/organization/OrganizationalContextReadRepository";
import { evaluateOrganizationalGovernance } from "./governance/OrganizationalGovernance";
import { projectProgramThroughOrganizationalGovernance } from "./governance/ProgramGovernanceGate";
import { ProductionOrganizationalGovernance } from "./governance/ProductionOrganizationalGovernance";
import { GovernedProgramEvaluationService } from "../program/GovernedProgramEvaluationService";
import { ImportReviewService } from "../import/staging/ImportReviewService";
import { programFixture } from "../../domain/program/program.fixture";
import type { OrganizationalContextReadPort } from "./OrganizationalContext";
import type { SessionUser } from "../../server/auth";

let testDatabasePath = "";

function fingerprint(databasePath: string): string {
  const database = new Database(databasePath, { readonly: true });
  const schema = database
    .prepare("SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name")
    .all();
  database.close();
  return JSON.stringify({
    bytes: createHash("sha256").update(fs.readFileSync(databasePath)).digest("hex"),
    schema
  });
}

beforeEach(() => {
  closeDatabase();
  testDatabasePath = path.join(os.tmpdir(), `pulse-organization-runtime-${Date.now()}-${Math.random()}.sqlite`);
  process.env.PULSE_DB_PATH = testDatabasePath;
  seedBaseline();
  closeDatabase();
});

describe("Phase 10B read-only runtime path", () => {
  it("does not mutate SQLite bytes or schema while building a snapshot", () => {
    const before = fingerprint(testDatabasePath);
    const organization = new SQLiteOrganizationRepository();
    const readSide: OrganizationalContextReadPort = new SQLiteOrganizationalContextReadRepository();
    const user: SessionUser = {
      id: "company",
      username: "company",
      role: "MANAGEMENT",
      scope: "COMPANY"
    };
    const context = new OrganizationalContextBuilder({ organization, readSide })
      .build({ type: "PERSON", id: "it-engineer" }, user, "2026-08-19T00:00:00.000Z");
    const snapshot = createOrganizationalContextSnapshot(context);
    const after = fingerprint(testDatabasePath);

    expect(snapshot.quality.status).toBe("COMPLETE");
    expect(snapshot.context.assignments.length).toBeGreaterThan(0);
    expect(after).toBe(before);
  });

  it("does not mutate SQLite while evaluating 10C against production read-side data", () => {
    const before = fingerprint(testDatabasePath);
    const organization = new SQLiteOrganizationRepository();
    const readSide = new SQLiteOrganizationalContextReadRepository();
    const user: SessionUser = {
      id: "company",
      username: "company",
      role: "MANAGEMENT",
      scope: "COMPANY"
    };
    const context = new OrganizationalContextBuilder({ organization, readSide })
      .build({ type: "PERSON", id: "it-engineer" }, user, "2026-08-19T00:00:00.000Z");
    const snapshot = createOrganizationalContextSnapshot(context);
    const governance = evaluateOrganizationalGovernance({
      snapshot,
      identity: organization,
      assignments: snapshot.context.assignments
    });
    const after = fingerprint(testDatabasePath);

    expect(governance.planYear).toBe(1405);
    expect(after).toBe(before);
  });

  it("does not mutate SQLite through the production governance gate projection", () => {
    const before = fingerprint(testDatabasePath);
    const organization = new SQLiteOrganizationRepository();
    const readSide = new SQLiteOrganizationalContextReadRepository();
    const user: SessionUser = {
      id: "company",
      username: "company",
      role: "MANAGEMENT",
      scope: "COMPANY"
    };
    const context = new OrganizationalContextBuilder({ organization, readSide })
      .build({ type: "PERSON", id: "it-engineer" }, user, "2026-08-19T00:00:00.000Z");
    const snapshot = createOrganizationalContextSnapshot(context);
    const program = structuredClone(programFixture);
    const assignment = snapshot.context.assignments[0];
    if (assignment) {
      program.goals[0].objectives[0].activities[0].assignments = [assignment];
    }
    const projected = projectProgramThroughOrganizationalGovernance(program, {
      snapshot,
      identity: organization
    });
    const after = fingerprint(testDatabasePath);

    expect(projected.governance.planYear).toBe(1405);
    expect(after).toBe(before);
  });

  it("does not mutate SQLite through the complete 10D governed evaluation path", () => {
    const before = fingerprint(testDatabasePath);
    const organization = new SQLiteOrganizationRepository();
    const readSide = new SQLiteOrganizationalContextReadRepository();
    const user: SessionUser = {
      id: "company",
      username: "company",
      role: "MANAGEMENT",
      scope: "COMPANY"
    };
    const context = new OrganizationalContextBuilder({ organization, readSide })
      .build({ type: "PERSON", id: "it-engineer" }, user, "2026-08-19T00:00:00.000Z");
    const snapshot = createOrganizationalContextSnapshot(context);
    const evaluation = new GovernedProgramEvaluationService().evaluate({
      program: structuredClone(programFixture),
      organizationalGovernance: {
        boundary: new ProductionOrganizationalGovernance(organization),
        input: { snapshot, identity: organization }
      }
    });
    const after = fingerprint(testDatabasePath);

    expect(evaluation.organizationalGovernance.planYear).toBe(1405);
    expect(after).toBe(before);
  });

  it("uses the actual production composition without persisting governed evaluation results", () => {
    const before = fingerprint(testDatabasePath);
    const user: SessionUser = {
      id: "company",
      username: "company",
      role: "MANAGEMENT",
      scope: "COMPANY"
    };
    const result = new ImportReviewService().evaluateGoverned(
      structuredClone(programFixture),
      user,
      "2026-08-19T00:00:00.000Z"
    );
    const repeated = new ImportReviewService().evaluateGoverned(
      structuredClone(programFixture),
      user,
      "2026-08-19T00:00:00.000Z"
    );
    const after = fingerprint(testDatabasePath);

    expect(result.qualityScore).toEqual(repeated.qualityScore);
    expect(result.organizationalGovernance).toEqual(repeated.organizationalGovernance);
    expect([...result.eligibleAssignmentIds]).toEqual([...repeated.eligibleAssignmentIds]);
    expect(after).toBe(before);
  });

  it("does not allow the persistence-oriented analyze path to silently persist governed evaluation", () => {
    const review = new ImportReviewService();
    const source = { type: "MANUAL" as const, name: "governed", metadata: {} };
    const job = review.createJob(source, "governed-no-persist");
    expect(() => review.analyze(job.id, structuredClone(programFixture), {
      organizationalGovernance: {
        boundary: new ProductionOrganizationalGovernance({
          listBusinessRoles: () => [],
          listExpertise: () => []
        }),
        input: {
          snapshot: createOrganizationalContextSnapshot({
            subject: { type: "PROGRAM_ENTITY", id: programFixture.id },
            person: { status: "MISSING", reason: "NOT_REQUIRED" },
            position: { status: "MISSING", reason: "NOT_REQUIRED" },
            unit: { status: "MISSING", reason: "NOT_REQUIRED" },
            positions: [],
            people: [],
            businessRoles: [],
            expertise: [],
            assignments: [],
            historicalEvidence: [],
            unresolvedReferences: [],
            provenance: [],
            authorizationScope: { scope: "COMPANY", subjectVisible: true },
            generatedAt: "2026-08-19T00:00:00.000Z"
          }),
          identity: new SQLiteOrganizationRepository()
        }
      }
    })).toThrow(/evaluateGoverned/);
  });
});
