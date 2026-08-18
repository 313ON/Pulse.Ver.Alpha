import { describe, expect, it } from "vitest";
import { programFixture } from "../../../domain/program/program.fixture";
import type { Assignment } from "../../../domain/program/Assignment";
import type { Program } from "../../../domain/program/types";
import type { ImportRecord, ImportSource } from "../contracts";
import { ImportReviewService } from "./ImportReviewService";

const source: ImportSource = {
  type: "MANUAL",
  name: "staging-test",
  metadata: {}
};

function reviewProgram(): Program {
  const program = structuredClone(programFixture);
  const assignment = (id: string, entityId: string, displayName: string, entityType: Assignment["entityType"]): Assignment => ({
    id,
    entityType,
    entityId,
    displayName,
    role: "EXECUTOR",
    responsibilityType: "PRIMARY"
  });
  for (const goal of program.goals) {
    for (const objective of goal.objectives) {
      for (const activity of objective.activities) {
        activity.assignments = [assignment(`${activity.id}-assignment`, "unit-it", "IT Department", "UNIT")];
        for (const action of activity.actions) {
          action.assignments = [assignment(`${action.id}-assignment`, "person-1", "Project Manager", "PERSON")];
        }
      }
    }
  }
  return program;
}

function importRecord(id: string, plannedEnd: string): ImportRecord {
  return {
    id,
    externalId: id,
    entityType: "action",
    source,
    data: { title: "Imported action", plannedEnd }
  };
}

describe("ImportReviewService", () => {
  it("approves a valid import job", () => {
    const service = new ImportReviewService();
    service.createJob(source, "job-valid");
    service.attachRecords("job-valid", [importRecord("record-1", "۱۴۰۵/۱۲/۲۹")]);
    const analyzed = service.analyze("job-valid", reviewProgram(), { today: "۱۴۰۵/۰۱/۰۱" });

    expect(analyzed.status).toBe("REVIEW_REQUIRED");
    expect(service.approvalReadiness("job-valid")).toEqual({ ready: true, blockers: [] });
    expect(service.approve("job-valid")).toMatchObject({ status: "APPROVED" });
    expect(service.getJob("job-valid").approvedAt).toBeTruthy();
  });

  it("rejects approval when validation errors contain invalid dates", () => {
    const service = new ImportReviewService();
    service.createJob(source, "job-invalid");
    service.attachRecords("job-invalid", [importRecord("record-1", "۱۴۰۵/۱۳/۰۱")]);
    service.analyze("job-invalid", reviewProgram());

    expect(service.approvalReadiness("job-invalid")).toMatchObject({
      ready: false,
      blockers: expect.arrayContaining(["Invalid dates must be corrected before approval."])
    });
    expect(() => service.approve("job-invalid")).toThrow("Invalid dates");
    expect(service.getJob("job-invalid").status).toBe("REVIEW_REQUIRED");
  });

  it("allows warning-only imports to be approved", () => {
    const service = new ImportReviewService();
    service.createJob(source, "job-warning");
    service.attachRecords("job-warning", [importRecord("record-1", "۱۴۰۵/۱۲/۲۹")]);
    const analyzed = service.analyze("job-warning", reviewProgram());

    expect(analyzed.assessmentResult?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MISSING_COLLABORATION_COVERAGE", severity: "warning" })
    ]));
    expect(service.approve("job-warning").status).toBe("APPROVED");
  });

  it("propagates the generated quality score onto the import job", () => {
    const service = new ImportReviewService();
    service.createJob(source, "job-score");
    service.attachRecords("job-score", [importRecord("record-1", "۱۴۰۵/۱۲/۲۹")]);
    const job = service.analyze("job-score", reviewProgram());

    expect(job.qualityScore).toMatchObject({
      dimensions: expect.objectContaining({
        hierarchy: expect.any(Number),
        responsibility: expect.any(Number)
      }),
      overallScore: expect.any(Number),
      generatedAt: expect.any(String)
    });
    expect(job.qualityScore?.overallScore).toBeGreaterThan(0);
  });
});
