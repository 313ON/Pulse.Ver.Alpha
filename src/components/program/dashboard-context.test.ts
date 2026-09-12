import { describe, expect, it } from "vitest";
import { dashboardContextFromSearchParams, dashboardContextToSearchParams, normalizeDashboardContext } from "./dashboard-context";
import { resolveDashboardContext } from "../../server/dashboard";
import { dashboardShareUrl } from "./DashboardShareButton";

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

  it("resolves partial, invalid, and unauthorized export contexts safely", () => {
    const options = { planYears: [1405, 1404], organizationalUnits: [{ id: "production", name: "Production" }, { id: "management", name: "Management" }] };
    expect(resolveDashboardContext(options, { planCycle: "1404" })).toEqual({ planYear: 1404, organizationalUnitId: "ALL" });
    expect(resolveDashboardContext(options, { unit: "production" })).toEqual({ planYear: 1405, organizationalUnitId: "production" });
    expect(resolveDashboardContext(options, { planCycle: "9999", unit: "missing" })).toEqual(fallback);
    expect(resolveDashboardContext(options, { planCycle: "1405", unit: "production" }, { id: "u", username: "u", role: "UNIT_MANAGER", scope: "DEPARTMENT", department_id: "management" })).toEqual(fallback);
  });

  it("does not emit invalid URL context as an authoritative share state", () => {
    const options = { planYears: [1405], organizationalUnits: [{ id: "production", name: "Production" }] };
    const safeContext = normalizeDashboardContext({ planYear: 9999, organizationalUnitId: "missing" }, options, fallback);
    expect(dashboardShareUrl("/program", safeContext)).toBe("/program?planCycle=1405&unit=ALL");
  });
});
