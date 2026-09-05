"use client";

import { useEffect, useState } from "react";
import { PulseShell } from "./PulseShell";

export function withGoalSummary(record: Record<string, unknown>, goals: Array<Record<string, unknown>>, id: string): Record<string, unknown> {
  const summary = goals.find((goal) => String(goal.id) === id);
  return summary ? { ...record, progress: summary.progress, health: summary.health, actionCount: summary.actionCount } : record;
}

export function DetailPage({ type, id }: { type: "actions" | "goals"; id: string }) {
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const requests = [fetch(`/api/${type}/${encodeURIComponent(id)}`)];
    if (type === "goals") requests.push(fetch("/api/dashboard"));
    Promise.all(requests).then(async ([recordResponse, dashboardResponse]) => {
      const body = await recordResponse.json();
      if (!recordResponse.ok) throw new Error(body.error ?? "اطلاعات یافت نشد.");
      if (dashboardResponse) {
        const dashboard = await dashboardResponse.json() as { goals?: Array<Record<string, unknown>> };
        Object.assign(body, withGoalSummary(body, dashboard.goals ?? [], id));
      }
      setRecord(body);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "اطلاعات یافت نشد."));
  }, [id, type]);
  const fieldLabels: Record<string, string> = { id: "شناسه", title: "عنوان", owner_person_id: "مسئول هدف", plan_year: "سال برنامه", progress: "پیشرفت", health: "سلامت هدف", actionCount: "تعداد اقدامات" };
  return <PulseShell><div className="page"><div className="page-heading"><div><div className="eyebrow">جزئیات و پیگیری</div><h1>{type === "actions" ? "جزئیات اقدام" : "جزئیات هدف"}</h1><p>{id}</p></div></div>{error ? <div className="empty">{error}</div> : !record ? <div className="empty">در حال دریافت اطلاعات...</div> : <>{type === "goals" && <div className="detail-summary"><div><span>پیشرفت هدف</span><strong>{String(record.progress ?? "۰")}٪</strong></div><div><span>سلامت</span><strong>{String(record.health ?? "خاکستری")}</strong></div><div><span>اقدامات مرتبط</span><strong>{String(record.actionCount ?? "۰")}</strong></div></div>}<div className="panel detail-card">{Object.entries(record).map(([key, value]) => <div className="detail-field" key={key}><span>{fieldLabels[key] ?? key}</span><strong>{String(value ?? "—")}</strong></div>)}</div></>}</div></PulseShell>;
}
