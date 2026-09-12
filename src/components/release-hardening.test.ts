import { describe, expect, it } from "vitest";
import { preserveDashboardContext } from "./CommandSidebar";
import { governedGoalOptions } from "../application/reporting/goal-options";
import { classifyReportState } from "./reporting/report-state";
import { classifyExecutionState } from "./program/execution-state";
import { executionContextQuery } from "./program/ExecutionCommandCenter";
import { resolveDashboardContext } from "../server/dashboard";

describe("release hardening state and context boundaries", () => {
  it("distinguishes report loading, success, empty, and failure states", () => {
    expect(classifyReportState(null).kind).toBe("loading");
    expect(classifyReportState({ rows: [{ id: "A1" }] }).kind).toBe("success");
    expect(classifyReportState({ rows: [] }).kind).toBe("empty");
    expect(classifyReportState(null, "network unavailable")).toEqual({ kind: "error", message: "network unavailable" });
  });

  it("distinguishes execution loading, populated, empty, and failure states", () => {
    expect(classifyExecutionState(null, null).kind).toBe("loading");
    expect(classifyExecutionState([{ id: "A1" }], []).kind).toBe("populated");
    expect(classifyExecutionState([], []).kind).toBe("empty");
    expect(classifyExecutionState(null, null, "request failed")).toEqual({ kind: "error", message: "request failed" });
  });

  it("passes the canonical dashboard context to program requests", () => {
    expect(executionContextQuery({ planYear: 1404, organizationalUnitId: "production" })).toBe("planCycle=1404&unit=production");
  });

  it("normalizes invalid program context through the existing dashboard authority", () => {
    const options = { planYears: [1405], organizationalUnits: [{ id: "production", name: "Production" }] };
    expect(resolveDashboardContext(options, { planCycle: "9999", unit: "missing" })).toEqual({ planYear: 1405, organizationalUnitId: "ALL" });
  });

  it("preserves context only for context-aware shared destinations", () => {
    const current = new URLSearchParams("planCycle=1405&unit=production&unrelated=drop");
    expect(preserveDashboardContext("/program", current)).toBe("/program?planCycle=1405&unit=production");
    expect(preserveDashboardContext("/reports", current)).toBe("/reports?planCycle=1405&unit=production");
    expect(preserveDashboardContext("/imports", current)).toBe("/imports");
  });

  it("derives report goal filters from visible governed rows", () => {
    const program = { goals: [{ id: "G01", title: "Visible" }, { id: "G99", title: "Not visible" }] } as never;
    const report = { rows: [{ goalId: "G01" }, { goalId: "G01" }] } as never;
    expect(governedGoalOptions(report, program)).toEqual([{ id: "G01", title: "Visible" }]);
  });
});
