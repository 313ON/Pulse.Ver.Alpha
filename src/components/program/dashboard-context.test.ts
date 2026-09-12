import { describe, expect, it } from "vitest";
import { dashboardContextFromSearchParams, dashboardContextToSearchParams, normalizeDashboardContext } from "./dashboard-context";

describe("dashboard URL context", () => {
  const fallback = { planYear: 1405, organizationalUnitId: "ALL" };

  it("restores valid combined context", () => {
    expect(dashboardContextFromSearchParams(new URLSearchParams("planCycle=1404&unit=production"), fallback)).toEqual({ planYear: 1404, organizationalUnitId: "production" });
  });

  it("handles invalid plan cycle and missing unit safely", () => {
    expect(dashboardContextFromSearchParams(new URLSearchParams("planCycle=invalid"), fallback)).toEqual(fallback);
    expect(normalizeDashboardContext({ planYear: 9999, organizationalUnitId: "does-not-exist" }, { planYears: [1405], organizationalUnits: [{ id: "production", name: "Production" }] }, fallback)).toEqual(fallback);
  });

  it("serializes filter changes without dropping unrelated parameters", () => {
    const params = dashboardContextToSearchParams({ planYear: 1405, organizationalUnitId: "management" }, new URLSearchParams("view=dashboard"));
    expect(params.toString()).toBe("view=dashboard&planCycle=1405&unit=management");
  });
});
