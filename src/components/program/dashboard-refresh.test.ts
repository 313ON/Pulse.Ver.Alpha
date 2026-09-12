import { describe, expect, it, vi } from "vitest";
import { createDashboardRefreshCoordinator, refreshDashboardState } from "./dashboard-refresh";

describe("dashboard refresh boundary", () => {
  it("loads a server-authoritative state without inventing freshness", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ state: { kind: "ready", program: {}, lastUpdated: "2026-09-09T08:00:00.000Z" } }), { status: 200 }));
    const state = await refreshDashboardState(fetcher as typeof fetch);
    expect(state.kind).toBe("ready");
    expect(state.kind === "ready" && state.lastUpdated).toBe("2026-09-09T08:00:00.000Z");
    expect(fetcher).toHaveBeenCalledWith("/api/dashboard/state", { cache: "no-store" });
  });

  it("rejects failed refreshes so the caller can preserve its current state", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: "temporary failure" }), { status: 503 }));
    await expect(refreshDashboardState(fetcher as typeof fetch)).rejects.toThrow("temporary failure");
  });

  it("refreshes the currently selected context", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ state: { kind: "ready", program: {}, lastUpdated: "2026-09-12T08:00:00.000Z" } }), { status: 200 }));
    await refreshDashboardState(fetcher as typeof fetch, { planYear: 1405, organizationalUnitId: "production" });
    expect(fetcher).toHaveBeenCalledWith("/api/dashboard/state?planCycle=1405&unit=production", { cache: "no-store" });
  });

  it("coalesces duplicate refresh requests while one request is active", async () => {
    let resolveResponse!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { resolveResponse = resolve; }));
    const refresh = createDashboardRefreshCoordinator(fetcher as typeof fetch);
    const first = refresh();
    const second = refresh();
    expect(first).toBe(second);
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolveResponse(new Response(JSON.stringify({ state: { kind: "empty", planYear: "۱۴۰۵", lastUpdated: "2026-09-09T08:00:00.000Z" } }), { status: 200 }));
    await first;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
