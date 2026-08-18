"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PulseShell } from "../components/PulseShell";
import { CognitionPanel } from "../components/cognition/CognitionPanel";

type Dashboard = {
  goals: Array<Record<string, unknown>>;
  departments: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
  risks: Array<Record<string, unknown>>;
  dependencies: Array<Record<string, unknown>>;
  score?: { total?: number };
  quality?: Record<string, number>;
};

export default function Home() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/dashboard").then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "خطا در دریافت داشبورد");
      setData(body);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "خطا در دریافت داشبورد"));
  }, []);
  return <PulseShell><div className="page">
    <div className="page-heading"><div><div className="eyebrow">مرکز کنترل مدیریت</div><h1>داشبورد عملکرد سالانه <span>✦</span></h1><p>نمایش یکپارچه اهداف، اقدامات، شاخص‌ها و موارد نیازمند توجه مدیریت</p></div><Link href="/actions" className="primary-button">＋ اقدام جدید</Link></div>
    <CognitionPanel />
    {error && <div className="empty">{error}</div>}
    {!data && !error && <div className="empty">در حال دریافت اطلاعات داشبورد...</div>}
    {data && <><div className="score-grid">
      <div className="score-card"><div className="card-title">امتیاز PULSE</div><div className="score-content"><div className="score-ring"><strong>{Number(data.score?.total ?? 0)}</strong><span>از ۱۰۰</span></div><div className="score-notes"><div><b className="green-text">کنترل فعال</b> وضعیت برنامه در حال پایش است</div><small>امتیاز بر اساس پیشرفت، تأخیر، ریسک و شاخص‌ها محاسبه می‌شود.</small></div></div></div>
      <Stat label="اقدامات فعال" value={String(data.actions.filter((item) => item.status !== "لغو شده").length)} tone="purple" />
      <Stat label="نیازمند توجه" value={String((data.quality?.overdue ?? 0) + data.actions.filter((item) => item.status === "مسدود").length)} tone="red" />
      <Stat label="ریسک‌های مهم" value={String(data.risks.filter((item) => Number(item.probability) * Number(item.impact) >= 15).length)} tone="yellow" />
    </div><div className="section-row">
      <div className="panel"><PanelTitle title="پیشرفت اهداف" href="/goals" /><div className="goal-list">{data.goals.map((goal) => <Link className="goal-row" key={String(goal.id)} href={`/goals?goal=${String(goal.id)}`}><span className="goal-id">{String(goal.id)}</span><span className="goal-title">{String(goal.title)}</span><span className="mini-progress"><i style={{ width: `${Number(goal.progress ?? 0)}%` }} /></span><b>{String(goal.progress ?? 0)}٪</b><span className="status-dot green" /></Link>)}</div></div>
      <div className="panel"><PanelTitle title="عملکرد واحدها" href="/departments" /><div className="unit-list">{data.departments.slice(0, 8).map((department) => <Link href={`/departments?department=${String(department.id)}`} className="unit-row" key={String(department.id)}><div className="unit-icon green">{String(department.name ?? "و").slice(0, 1)}</div><div className="unit-info"><strong>{String(department.name)}</strong><span>{String(department.actionCount ?? 0)} اقدام</span></div><div className="unit-value"><b>{String(department.progress ?? 0)}٪</b><span className="status-pill green">پایش</span></div></Link>)}</div></div>
    </div><div className="section-row">
      <div className="panel"><PanelTitle title="اقدامات نیازمند توجه" href="/actions" /><div className="table-wrap"><table><thead><tr><th>اقدام</th><th>مسئول</th><th>موعد</th><th>وضعیت</th><th>پیشرفت</th></tr></thead><tbody>{data.actions.filter((item) => item.status === "مسدود" || Number(item.progress) < 50).slice(0, 8).map((item) => <tr key={String(item.public_id)}><td><Link href={`/actions?item=${String(item.public_id)}`}><strong>{String(item.title)}</strong><small>{String(item.public_id)}</small></Link></td><td>{String(item.owner ?? "—")}</td><td>{String(item.planned_end ?? "—")}</td><td><span className="status-pill red">{String(item.status)}</span></td><td>{String(item.progress ?? 0)}٪</td></tr>)}</tbody></table></div></div>
      <div className="panel"><PanelTitle title="وابستگی‌های باز" href="/dependencies" /><div className="empty">{data.dependencies.filter((item) => item.status !== "حل‌شده").length} وابستگی نیازمند پیگیری است.</div><PanelTitle title="ریسک‌های مهم" href="/risks" /><div className="empty">{data.risks.filter((item) => Number(item.probability) * Number(item.impact) >= 15).length} ریسک با شدت بالا ثبت شده است.</div></div>
    </div></>}
  </div></PulseShell>;
}

function PanelTitle({ title, href }: { title: string; href: string }) {
  return <div className="panel-head"><h2>{title}</h2><Link href={href}>مشاهده همه ‹</Link></div>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>●</div><div className="card-title">{label}</div><div className="stat-value">{value}</div><div className="stat-footer"><span>در برنامه ۱۴۰۵</span><b className={tone === "red" ? "red-text" : "green-text"}>به‌روز</b></div></div>;
}
