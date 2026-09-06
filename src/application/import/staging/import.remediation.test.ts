import { describe, expect, it } from "vitest";
import { programFixture } from "../../../domain/program/program.fixture";
import type { ImportRecord, ImportSource } from "../contracts";
import { ImportReviewService } from "./ImportReviewService";

const source: ImportSource = { type: "MANUAL", name: "staging-test", metadata: {} };
const record = (id: string): ImportRecord => ({
  id, externalId: id, entityType: "action", source,
  data: { title: "Imported action", plannedEnd: "۱۴۰۵/۱۲/۲۹" }
});

describe("goal governance contract", () => {
  it("does not emit or remediate a nonexistent goal-owner rule", () => {
    const service = new ImportReviewService();
    service.createJob(source, "no-goal-owner");
    service.attachRecords("no-goal-owner", [record("record-1")]);
    const analyzed = service.analyze("no-goal-owner", structuredClone(programFixture));
    expect(analyzed.assessmentResult?.governance.errors.some((item) => item.rule === "goal.owner.required")).toBe(false);
    expect(service.approvalReadiness("no-goal-owner").blockers).not.toContain("Goal owner is required.");
  });

  it("rejects legacy goal-owner remediation calls explicitly", () => {
    const service = new ImportReviewService();
    expect(() => service.assignGoalOwner("missing", structuredClone(programFixture), {} as never, {})).toThrow(/not part of the PULSE business model/i);
  });
});
