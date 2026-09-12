import type { DashboardState } from "./dashboard-state";
import type { DashboardContext } from "./dashboard-context";

export type DashboardStateFetcher = typeof fetch;

export function refreshDashboardState(fetcher: DashboardStateFetcher, context?: DashboardContext): Promise<DashboardState> {
  const query = context ? `?planYear=${encodeURIComponent(context.planYear)}&organizationalUnitId=${encodeURIComponent(context.organizationalUnitId)}` : "";
  const response = fetcher(`/api/dashboard/state${query}`, { cache: "no-store" });
  return response.then(async (result) => {
    const body = await result.json() as { state?: DashboardState; error?: string };
    if (!result.ok || !body.state) throw new Error(body.error ?? "به‌روزرسانی داشبورد انجام نشد.");
    return body.state;
  });
}

export function createDashboardRefreshCoordinator(fetcher: DashboardStateFetcher, getContext?: () => DashboardContext | undefined): () => Promise<DashboardState> {
  let inFlight: Promise<DashboardState> | null = null;
  return () => {
    if (inFlight) return inFlight;
    inFlight = refreshDashboardState(fetcher, getContext?.()).finally(() => { inFlight = null; });
    return inFlight;
  };
}
