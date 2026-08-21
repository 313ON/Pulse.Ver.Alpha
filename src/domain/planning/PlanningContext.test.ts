import { describe, expect, it } from "vitest";
import { createPlanningContext, getPlanningContext } from "./PlanningContext";

describe("PlanningContext", () => {
  it("preserves the current 1405 behavior by default", () => {
    expect(createPlanningContext()).toEqual({
      planYear: 1405,
      startDate: "1405/01/01",
      endDate: "1405/12/29",
      today: "1405/06/15"
    });
  });

  it("represents another cycle without source changes", () => {
    expect(getPlanningContext({
      PULSE_PLAN_YEAR: "1406",
      PULSE_PLAN_START_DATE: "1406/01/01",
      PULSE_PLAN_END_DATE: "1406/12/29",
      PULSE_PLAN_TODAY: "1406/07/01"
    } as unknown as NodeJS.ProcessEnv)).toEqual({
      planYear: 1406,
      startDate: "1406/01/01",
      endDate: "1406/12/29",
      today: "1406/07/01"
    });
  });
});
