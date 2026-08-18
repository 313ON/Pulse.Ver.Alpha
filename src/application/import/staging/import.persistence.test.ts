import { describe, expect, it } from "vitest";
import { InMemoryImportJobRepository, InMemoryImportRecordRepository } from "../adapters";
import { programFixture } from "../../../domain/program/program.fixture";
import type { Assignment } from "../../../domain/program/Assignment";
import type { Program } from "../../../domain/program/types";
import type { ImportRecord, ImportSource } from "../contracts";
import { ImportReviewService } from "./ImportReviewService";

const source: ImportSource = { type: "MANUAL", name: "persistence-test", metadata: {} };

function programForPersistence(): Program {
  const program = structuredClone(programFixture);
  const assignment = (id: string, entityId: string, entityType: Assignment["entityType"]): Assignment => ({
    id,
    entityId,
    entityType,
    displayName: entityId,
    role: "EXECUTOR",
    responsibilityType: "PRIMARY"
  });
  for (const goal of program.goals) {
    for (const objective of goal.objectives) {
      for (const activity of objective.activities) {
        activity.assignments = [assignment(`${activity.id}-assignment`, "unit-1", "UNIT")];
        for (const action of activity.actions) action.assignments = [assignment(`${action.id}-assignment`, "person-1", "PERSON")];
      }
    }
  }
  return program;
}

function records(): ImportRecord[] {
  return [{
    id: "record-1",
    externalId: "external-1",
    entityType: "action",
    source,
    data: { title: "اقدام", plannedEnd: "۱۴۰۵/۱۲/۲۹" }
  }];
}

describe("Import persistence boundaries", () => {
  it("persists job lifecycle and retrieves attached records", () => {
    const jobRepository = new InMemoryImportJobRepository();
    const recordRepository = new InMemoryImportRecordRepository();
    const service = new ImportReviewService(undefined, jobRepository, recordRepository);

    service.createJob(source, "job-lifecycle");
    service.attachRecords("job-lifecycle", records());

    expect(recordRepository.getByJobId("job-lifecycle")).toHaveLength(1);
    expect(service.getJob("job-lifecycle").records).toEqual(records());
    expect(jobRepository.get("job-lifecycle")?.status).toBe("DRAFT");
  });

  it("persists approval state after analysis and approval", () => {
    const jobRepository = new InMemoryImportJobRepository();
    const recordRepository = new InMemoryImportRecordRepository();
    const service = new ImportReviewService(undefined, jobRepository, recordRepository);

    service.createJob(source, "job-approved");
    service.attachRecords("job-approved", records());
    service.analyze("job-approved", programForPersistence());
    service.approve("job-approved");

    expect(jobRepository.get("job-approved")).toMatchObject({
      status: "APPROVED",
      approvedAt: expect.any(String),
      validationResult: expect.any(Object),
      assessmentResult: expect.any(Object),
      qualityScore: expect.any(Object)
    });
  });

  it("persists rejection state", () => {
    const jobRepository = new InMemoryImportJobRepository();
    const recordRepository = new InMemoryImportRecordRepository();
    const service = new ImportReviewService(undefined, jobRepository, recordRepository);

    service.createJob(source, "job-rejected");
    service.attachRecords("job-rejected", records());
    service.analyze("job-rejected", programForPersistence());
    service.reject("job-rejected");

    expect(jobRepository.get("job-rejected")?.status).toBe("REJECTED");
  });
});
