"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DashboardState } from "./dashboard-state";
import { DashboardStateView } from "./DashboardStateView";
import { StrategicCommandCenter } from "./StrategicCommandCenter";
import { createDashboardRefreshCoordinator, refreshDashboardState } from "./dashboard-refresh";
import type { DashboardContext, DashboardContextOptions } from "./dashboard-context";
import { ALL_ORGANIZATIONAL_UNITS, dashboardContextFromSearchParams, dashboardContextToSearchParams, normalizeDashboardContext } from "./dashboard-context";

type RefreshState = "idle" | "refreshing" | "failed";

export function DashboardController({ initialState, today, initialContext, contextOptions }: { initialState: DashboardState; today: string; initialContext: DashboardContext; contextOptions: DashboardContextOptions }) {
  const [state, setState] = useState(initialState);
  const [context, setContext] = useState(initialContext);
  const contextRef = useRef(initialContext);
  contextRef.current = context;
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");
  const [refreshError, setRefreshError] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialUrlSyncRef = useRef(true);
  const coordinatorRef = useRef<(() => Promise<DashboardState>) | null>(null);
  if (!coordinatorRef.current) coordinatorRef.current = createDashboardRefreshCoordinator(fetch, () => contextRef.current);

  useEffect(() => {
    const requested = dashboardContextFromSearchParams(new URLSearchParams(searchParams.toString()), initialContext);
    const next = normalizeDashboardContext(requested, contextOptions, initialContext);
    if (requested.planYear !== next.planYear || requested.organizationalUnitId !== next.organizationalUnitId) {
      router.replace(`${pathname}?${dashboardContextToSearchParams(next).toString()}`, { scroll: false });
      return;
    }
    const sameContext = next.planYear === contextRef.current.planYear && next.organizationalUnitId === contextRef.current.organizationalUnitId;
    if (initialUrlSyncRef.current) {
      initialUrlSyncRef.current = false;
      return;
    }
    if (sameContext) return;
    setContext(next);
    setRefreshState("refreshing");
    setRefreshError("");
    void refreshDashboardState(fetch, next)
      .then((nextState) => { setState(nextState); setRefreshState("idle"); })
      .catch((error: unknown) => { setRefreshState("failed"); setRefreshError(error instanceof Error ? error.message : "دریافت زمینه داشبورد انجام نشد."); });
  }, [initialContext.planYear, pathname, searchParams]);

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

  function changeContext(next: DashboardContext) {
    const params = dashboardContextToSearchParams(next, new URLSearchParams(searchParams.toString()));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const lastUpdated = state.kind === "ready" || state.kind === "partial" || state.kind === "empty" ? state.lastUpdated : undefined;
  return (
    <div className="dashboard-controller">
      <div className="dashboard-context-bar" aria-label="زمینه داشبورد"><label>چرخه برنامه<select value={context.planYear} onChange={(event) => changeContext({ ...context, planYear: Number(event.target.value) })} disabled={refreshState === "refreshing"}>{contextOptions.planYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label><label>واحد سازمانی<select value={context.organizationalUnitId} onChange={(event) => changeContext({ ...context, organizationalUnitId: event.target.value })} disabled={refreshState === "refreshing"}><option value={ALL_ORGANIZATIONAL_UNITS}>همه واحدها</option>{contextOptions.organizationalUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><span>زمینه فعال: {context.planYear} / {context.organizationalUnitId === ALL_ORGANIZATIONAL_UNITS ? "همه واحدها" : contextOptions.organizationalUnits.find((unit) => unit.id === context.organizationalUnitId)?.name}</span></div>
      <div className="dashboard-freshness-bar" role="status" aria-live="polite">
        <div><span className="program-panel-kicker">وضعیت داده</span><strong>{refreshState === "refreshing" ? "در حال به‌روزرسانی…" : refreshState === "failed" ? "به‌روزرسانی ناموفق بود" : "آخرین داده معتبر"}</strong>{lastUpdated && <time dateTime={lastUpdated}>آخرین دریافت: {formatFreshness(lastUpdated)}</time>}</div>
        <button className="secondary-button dashboard-refresh-button" type="button" onClick={() => void refresh()} disabled={refreshState === "refreshing"} aria-label="به‌روزرسانی داشبورد">{refreshState === "refreshing" ? "در حال دریافت…" : "↻ به‌روزرسانی"}</button>
      </div>
      {refreshState === "failed" && <div className="dashboard-refresh-error" role="alert"><span>{refreshError}</span><button className="primary-button" type="button" onClick={() => void refresh()}>تلاش دوباره</button></div>}
      {state.kind === "ready" ? <StrategicCommandCenter state={state} today={today} dashboardContext={context} /> : state.kind === "partial" ? <><StrategicCommandCenter state={state} today={today} dashboardContext={context} /><div className="dashboard-partial-data-note">داده‌های موجود نگه داشته شده‌اند؛ پس از تکمیل ورودی، داشبورد را دوباره به‌روزرسانی کنید.</div></> : state.kind === "loading" ? null : <DashboardStateView state={state} onRetry={() => void refresh()} />}
    </div>
  );
}

export function formatFreshness(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "زمان نامعتبر";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}
