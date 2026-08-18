"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PulseShell } from "../PulseShell";

type ActionRow = { public_id?: string; title?: string; status?: string; progress?: number; owner?: string; department?: string };
type ActivityRow = { id?: string; title?: string; owner?: string; activity_action_count?: number };

export function ExecutionCommandCenter() {
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/actions").then((response) => response.json()),
      fetch("/api/activities").then((response) => response.json())
    ]).then(([actionBody, activityBody]) => {
      if (!Array.isArray(actionBody) || !Array.isArray(activityBody)) throw new Error("داده‌های اجرایی دریافت نشد.");
      setActions(actionBody);
      setActivities(activityBody);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "داده‌های اجرایی دریافت نشد."));
  }, []);

  const completed = actions.filter((action) => Number(action.progress ?? 0) >= 100).length;
  const active = actions.filter((action) => action.status === "در حال اجرا").length;
  const averageProgress = useMemo(() => actions.length === 0 ? 0 : Math.round(actions.reduce((total, action) => total + Number(action.progress ?? 0), 0) / actions.length), [actions]);

  return <PulseShell><div className="page execution-command-center">
    <div className="page-heading strategic-heading"><div><div className="eyebrow">نمای اجرایی / پایش عملیات</div><h1>کنترل اجرای برنامه</h1><p>فعالیت‌ها، اقدامات، پیشرفت و وضعیت اجرا در یک نمای عملیاتی مستقل</p></div><div className="strategic-heading-actions"><Link href="/activities" className="secondary-button">فعالیت‌ها</Link><Link href="/actions" className="primary-button">＋ اقدام جدید</Link></div></div>
    <div className="execution-summary"><ExecutionMetric label="اقدامات" value={actions.length} detail="در محدوده دسترسی" /><ExecutionMetric label="در حال اجرا" value={active} detail="نیازمند پایش" /><ExecutionMetric label="تکمیل‌شده" value={completed} detail="به پایان رسیده" /><div className="execution-progress panel"><span>میانگین پیشرفت</span><strong>{averageProgress}٪</strong><div className="program-progress-track"><span style={{ width: `${averageProgress}%` }} /></div></div></div>
    {error ? <div className="empty">{error}</div> : <div className="execution-grid"><section className="panel"><div className="panel-head"><h2>اقدامات اخیر</h2><Link href="/actions">مشاهده همه</Link></div><div className="execution-list">{actions.slice(0, 8).map((action, index) => <div className="execution-row" key={action.public_id ?? index}><div><strong>{action.title ?? "بدون عنوان"}</strong><span>{action.owner ?? "مسئول تعیین نشده"}{action.department ? ` · ${action.department}` : ""}</span></div><div className="execution-row-progress"><i style={{ width: `${Math.min(100, Math.max(0, Number(action.progress ?? 0)))}%` }} /><b>{Number(action.progress ?? 0)}٪</b></div><small>{action.status ?? "بدون وضعیت"}</small></div>)}</div></section><section className="panel"><div className="panel-head"><h2>فعالیت‌های عملیاتی</h2><Link href="/activities">مشاهده همه</Link></div><div className="execution-list">{activities.slice(0, 8).map((activity, index) => <div className="execution-row compact" key={activity.id ?? index}><div><strong>{activity.title ?? "بدون عنوان"}</strong><span>{activity.owner ?? "مسئول تعیین نشده"}</span></div><small>{Number(activity.activity_action_count ?? 0)} اقدام مرتبط</small></div>)}</div></section></div>}
  </div></PulseShell>;
}

function ExecutionMetric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="execution-metric panel"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
