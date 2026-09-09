"use client";

import { useRef, useState } from "react";
import type { DashboardState } from "./dashboard-state";
import { DashboardStateView } from "./DashboardStateView";
import { StrategicCommandCenter } from "./StrategicCommandCenter";
import { createDashboardRefreshCoordinator } from "./dashboard-refresh";

type RefreshState = "idle" | "refreshing" | "failed";

export function DashboardController({ initialState, today }: { initialState: DashboardState; today: string }) {
  const [state, setState] = useState(initialState);
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");
  const [refreshError, setRefreshError] = useState("");
  const coordinatorRef = useRef<(() => Promise<DashboardState>) | null>(null);
  if (!coordinatorRef.current) coordinatorRef.current = createDashboardRefreshCoordinator(fetch);

  function refresh(): Promise<void> {
    setRefreshState("refreshing");
    setRefreshError("");
    const request = coordinatorRef.current!()
      .then((nextState) => {
        setState(nextState);
        setRefreshState("idle");
      })
      .catch((error: unknown) => {
        setRefreshState("failed");
        setRefreshError(error instanceof Error ? error.message : "به‌روزرسانی داشبورد انجام نشد.");
      })
      ;
    return request;
  }

  const lastUpdated = state.kind === "ready" || state.kind === "partial" || state.kind === "empty" ? state.lastUpdated : undefined;
  return (
    <div className="dashboard-controller">
      <div className="dashboard-freshness-bar" role="status" aria-live="polite">
        <div><span className="program-panel-kicker">وضعیت داده</span><strong>{refreshState === "refreshing" ? "در حال به‌روزرسانی…" : refreshState === "failed" ? "به‌روزرسانی ناموفق بود" : "آخرین داده معتبر"}</strong>{lastUpdated && <time dateTime={lastUpdated}>آخرین دریافت: {formatFreshness(lastUpdated)}</time>}</div>
        <button className="secondary-button dashboard-refresh-button" type="button" onClick={() => void refresh()} disabled={refreshState === "refreshing"} aria-label="به‌روزرسانی داشبورد">{refreshState === "refreshing" ? "در حال دریافت…" : "↻ به‌روزرسانی"}</button>
      </div>
      {refreshState === "failed" && <div className="dashboard-refresh-error" role="alert"><span>{refreshError}</span><button className="primary-button" type="button" onClick={() => void refresh()}>تلاش دوباره</button></div>}
      {state.kind === "ready" ? <StrategicCommandCenter state={state} today={today} /> : state.kind === "partial" ? <><StrategicCommandCenter state={state} today={today} /><div className="dashboard-partial-data-note">داده‌های موجود نگه داشته شده‌اند؛ پس از تکمیل ورودی، داشبورد را دوباره به‌روزرسانی کنید.</div></> : state.kind === "loading" ? null : <DashboardStateView state={state} onRetry={() => void refresh()} />}
    </div>
  );
}

export function formatFreshness(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "زمان نامعتبر";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}
