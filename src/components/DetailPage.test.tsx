import { describe, expect, it } from "vitest";
import { withGoalSummary } from "./DetailPage";

describe("goal detail management summary", () => {
  it("adds the dashboard progress summary without changing source fields", () => {
    expect(withGoalSummary(
      { id: "G01", title: "هدف" },
      [{ id: "G01", progress: 68, health: "زرد", actionCount: 1 }],
      "G01"
    )).toMatchObject({ id: "G01", title: "هدف", progress: 68, health: "زرد", actionCount: 1 });
  });
});
