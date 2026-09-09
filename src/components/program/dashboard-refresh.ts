import type { DashboardState } from "./dashboard-state";

export type DashboardStateFetcher = typeof fetch;

export function refreshDashboardState(fetcher: DashboardStateFetcher): Promise<DashboardState> {
  const response = fetcher("/api/dashboard/state", { cache: "no-store" });
  return response.then(async (result) => {
    const body = await result.json() as { state?: DashboardState; error?: string };
    if (!result.ok || !body.state) throw new Error(body.error ?? "به‌روزرسانی داشبورد انجام نشد.");
    return body.state;
  });
}

export function createDashboardRefreshCoordinator(fetcher: DashboardStateFetcher): () => Promise<DashboardState> {
  let inFlight: Promise<DashboardState> | null = null;
  return () => {
    if (inFlight) return inFlight;
    inFlight = refreshDashboardState(fetcher).finally(() => { inFlight = null; });
    return inFlight;
  };
}
