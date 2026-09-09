"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DashboardState } from "./dashboard-state";

export function DashboardStateView({ state }: { state: Exclude<DashboardState, { kind: "ready" | "loading" }> }) {
  const router = useRouter();
  if (state.kind === "empty") {
    return <StateCard tone="empty" label="داده برنامه" title="هنوز داده قابل استفاده‌ای برای نمایش وجود ندارد" message={`برای چرخه ${state.planYear} هنوز هدفی در برنامه ثبت نشده است.`} action={<Link className="primary-button" href="/imports">ورود داده برنامه</Link>} />;
  }
  if (state.kind === "partial") {
    return <StateCard tone="partial" label="نمای ناقص برنامه" title="بخشی از برنامه آماده نمایش است" message={`اطلاعات ${state.missing.join(" و ")} هنوز در داده‌های متصل وجود ندارد؛ اعداد ناموجود به‌عنوان صفر نمایش داده نمی‌شوند.`} action={<Link className="secondary-button" href="/imports">بررسی ورود داده</Link>}><div className="dashboard-available-summary"><strong>{state.program.goals.length}</strong><span>هدف راهبردی ثبت‌شده</span></div></StateCard>;
  }
  const blocking = state.kind === "blocking-error";
  return <StateCard tone={blocking ? "blocking" : "error"} label={blocking ? "دسترسی به داده برنامه" : "دریافت داده برنامه"} title={blocking ? "داشبورد فعلاً قابل استفاده نیست" : "دریافت داشبورد انجام نشد"} message={state.message} action={blocking ? <Link className="secondary-button" href="/imports">بررسی ورودی داده</Link> : <button className="primary-button" type="button" onClick={() => router.refresh()}>تلاش دوباره</button>}><p className="dashboard-state-guidance">{blocking ? state.guidance : "اگر مشکل ادامه داشت، کمی بعد دوباره تلاش کنید."}</p></StateCard>;
}

function StateCard({ tone, label, title, message, action, children }: { tone: string; label: string; title: string; message: string; action: React.ReactNode; children?: React.ReactNode }) {
  return <div className="page strategic-command-center dashboard-state-page"><section className={`panel dashboard-state-card ${tone}`} role={tone === "error" || tone === "blocking" ? "alert" : undefined} aria-labelledby="dashboard-state-title"><span className="program-panel-kicker">{label}</span><h1 id="dashboard-state-title">{title}</h1><p>{message}</p>{children}<div className="dashboard-state-actions">{action}</div></section></div>;
}
