import { describe, expect, it } from "vitest";
import {
  applyGoalOwnerOverlay,
  GOAL_OWNER_REQUIRED_RULE,
  validateAssignGoalOwnerRemediation
} from "./AssignGoalOwnerRemediation";

describe("AssignGoalOwnerRemediation", () => {
  const valid = {
    importJobId: "job-1",
    rule: GOAL_OWNER_REQUIRED_RULE,
    targetEntityType: "goal" as const,
    targetGoalId: "G01",
    proposedOwnerPersonId: "person-1",
    reason: "مالک از فهرست سازمانی تأیید شد."
  };

  it("accepts a valid scoped remediation", () => {
    expect(validateAssignGoalOwnerRemediation(valid)).toEqual(valid);
  });

  it.each([
    ["invalid rule", { ...valid, rule: "goal.title.required" }],
    ["invalid target", { ...valid, targetEntityType: "action" }],
    ["empty owner", { ...valid, proposedOwnerPersonId: " " }],
    ["empty reason", { ...valid, reason: " " }]
  ])("rejects %s", (_, input) => {
    expect(() => validateAssignGoalOwnerRemediation(input as never)).toThrow();
  });

  it("overlays only the requested goal without mutating the original", () => {
    const program = { goals: [{ id: "G01", owner: "" }, { id: "G02", owner: "" }] };
    const result = applyGoalOwnerOverlay(program, "G01", "Person One");
    expect(program.goals[0].owner).toBe("");
    expect(result.goals).toEqual([{ id: "G01", owner: "Person One" }, { id: "G02", owner: "" }]);
  });
});
