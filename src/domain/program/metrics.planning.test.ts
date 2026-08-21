import { describe, expect, it } from "vitest";
import { calculatePulseScore } from "./metrics";
import type { Action } from "./types";

describe("planning-aware program metrics", () => {
  it("uses the supplied planning date for overdue calculations", () => {
    const action = {
      id: "action",
      title: "اقدام",
      status: "در حال اجرا" as const,
      progress: 20,
      plannedEnd: "1406/06/30",
      kpis: [],
      assignments: [],
      type: "action" as const,
      activityId: "activity"
    } as unknown as Action;
    const before = calculatePulseScore([50], [action], [], [], "1406/06/01");
    const after = calculatePulseScore([50], [action], [], [], "1406/07/01");
    expect(after.overdueControl).toBeLessThan(before.overdueControl);
  });
});
