import Link from "next/link";
import type { CSSProperties } from "react";
import type { Action, Program } from "../../domain/program";
import { CognitionPanel } from "../cognition/CognitionPanel";
import { HierarchyBreadcrumb } from "./HierarchyBreadcrumb";
import { ProgramTree } from "./ProgramTree";
import { ProgressIndicator } from "./ProgressIndicator";

export function StrategicCommandCenter({ program }: { program: Program }) {
  const goals = program.goals;
  const objectives = goals.reduce((total, goal) => total + goal.objectives.length, 0);
  const actions = goals.flatMap((goal) => goal.objectives.flatMap((objective) => objective.activities.flatMap((activity) => activity.actions)));
  const kpis = actions.flatMap((action) => action.kpis);
  const averageProgress = actions.length === 0 ? program.progress : Math.round(actions.reduce((total, action) => total + action.progress, 0) / actions.length);
  const atRisk = goals.filter((goal) => goal.progress < 50 || goal.status === "مسدود").length;
  const overdue = actions.filter((action) => action.progress < 50 || action.status === "مسدود").length;
  const criticalKpis = kpis.filter((kpi) => kpi.actual < kpi.target).length;
  const pulseScore = Math.max(0, Math.min(100, Math.round(program.progress * 0.45 + averageProgress * 0.35 + ((kpis.length - criticalKpis) / Math.max(1, kpis.length)) * 20)));

  return (
    <div className="page strategic-command-center">
      <div className="page-heading strategic-heading">
        <div>
          <div className="eyebrow">مرکز فرمان راهبردی / چرخه ۱۴۰۵</div>
          <h1>معماری برنامه سازمانی <span>✦</span></h1>
          <p>از ایده تا اجرا</p>
          <HierarchyBreadcrumb nodes={[program]} />
        </div>
        <div className="strategic-heading-actions">
          <Link href="/reports" className="secondary-button">گزارش برنامه</Link>
          <Link href="/actions" className="primary-button">＋ اقدام جدید</Link>
        </div>
      </div>
      <ExecutivePulse score={pulseScore} progress={averageProgress} atRisk={atRisk} overdue={overdue} criticalKpis={criticalKpis} goals={goals} actions={actions} />
      <div className="strategic-summary">
        <div className="strategic-summary-main"><div><span className="program-panel-kicker">برنامه فعال</span><h2>{program.title}</h2><p>{program.description}</p></div><ProgressIndicator value={program.progress} /></div>
        <SummaryMetric label="اهداف راهبردی" value={goals.length} detail="در سطح برنامه" tone="cyan" />
        <SummaryMetric label="اهداف جزئی" value={objectives} detail="در مسیر اجرا" tone="amber" />
        <SummaryMetric label="اقدامات متصل" value={actions.length} detail="قابل پیگیری" tone="green" />
      </div>
      <CognitionPanel />
      {goals.length === 0 ? <EmptyProgramState /> : <ProgramTree program={program} />}
    </div>
  );
}

function ExecutivePulse({ score, progress, atRisk, overdue, criticalKpis, goals, actions }: { score: number; progress: number; atRisk: number; overdue: number; criticalKpis: number; goals: Program["goals"]; actions: Action[] }) {
  const departments = Array.from(new Set(actions.map((action) => action.department?.label ?? "سایر"))).map((department) => {
    const scoped = actions.filter((action) => (action.department?.label ?? "سایر") === department);
    return { department, progress: Math.round(scoped.reduce((sum, action) => sum + action.progress, 0) / Math.max(1, scoped.length)), count: scoped.length };
  }).sort((a, b) => b.progress - a.progress);
  const attention = actions.filter((action) => action.status === "مسدود" || action.progress < 50);
  const healthy = goals.filter((goal) => goal.progress >= 70);
  const chartValues = goals.length > 0 ? goals.slice(0, 6).map((goal) => goal.progress) : [0];
  const chartPath = chartValues.map((value, index) => `${index === 0 ? "M" : "L"}${(index / Math.max(1, chartValues.length - 1)) * 640},${168 - value * 1.35}`).join(" ");
  const chartAreaPath = `${chartPath} L640,180 L0,180 Z`;

  return <section className="executive-layer" aria-labelledby="executive-pulse-title">
    <Link href="/goals" className="executive-kpi pulse-score-card">
      <div className="executive-card-top"><span className="executive-kicker">شاخص سلامت سازمان</span><span className="status-pill green">پایش زنده</span></div>
      <div className="pulse-score-body"><div className="pulse-score-ring" style={{ "--score": `${score * 3.6}deg` } as CSSProperties}><strong>{score}</strong><span>از ۱۰۰</span></div><div><h2 id="executive-pulse-title">Pulse Score</h2><p>ترکیب پیشرفت برنامه، اجرای اقدامات و تحقق شاخص‌ها</p><strong className="trend-positive">روند مثبت <small>بر اساس داده‌های چرخه جاری</small></strong></div></div>
    </Link>
    <MetricTile href="/goals" label="پیشرفت کلی" value={`${progress}٪`} detail="میانگین اقدامات" tone="green" />
    <MetricTile href="/risks" label="نیازمند توجه" value={atRisk} detail="هدف در معرض انحراف" tone="amber" />
    <MetricTile href="/actions?status=overdue" label="اقدام عقب‌مانده" value={overdue} detail="ریسک عملیاتی" tone="red" />
    <MetricTile href="/kpis" label="شاخص بحرانی" value={criticalKpis} detail="پایین‌تر از هدف" tone="violet" />
    <section className="executive-panel performance-panel"><PanelHeading kicker="روند تحقق برنامه" title="عملکرد راهبردی" meta="واقعی / هدف" /><Link className="executive-panel-link" href="/goals" aria-label="مشاهده عملکرد اهداف"><div className="performance-chart" role="img" aria-label="نمودار مقایسه پیشرفت اهداف راهبردی"><div className="chart-grid"><i /><i /><i /><i /></div><svg viewBox="0 0 640 180" preserveAspectRatio="none"><path className="chart-area" d={chartAreaPath} /><path className="chart-line" d={chartPath} /></svg><div className="chart-labels">{chartValues.map((_, index) => <span key={index}>هدف {index + 1}</span>)}</div></div></Link></section>
    <section className="executive-panel department-panel"><PanelHeading kicker="مقایسه واحدها" title="عملکرد واحدی" meta="بر اساس اقدام" /><div className="department-list">{departments.slice(0, 6).map((row) => <Link className="department-row" href="/departments" key={row.department}><div className="department-label"><strong>{row.department}</strong><small>{row.count} اقدام</small></div><div className="department-bar"><span style={{ width: `${row.progress}%` }} /></div><b>{row.progress}٪</b><span className={`status-dot ${row.progress >= 70 ? "green" : row.progress >= 50 ? "yellow" : "red"}`} aria-label="وضعیت عملکرد" /></Link>)}</div></section>
    <section className="executive-panel attention-panel"><PanelHeading kicker="سیگنال‌های مدیریتی" title="نیازمند توجه مدیریت" meta="اولویت‌بندی‌شده" /><div className="attention-grid"><AttentionGroup title="اقدام فوری" tone="critical" items={attention.slice(0, 1)} /><AttentionGroup title="نیازمند توجه" tone="warning" items={attention.slice(1, 2)} /><AttentionGroup title="در مسیر صحیح" tone="healthy" items={healthy} /></div></section>
    <section className="executive-panel timeline-panel"><PanelHeading kicker="جریان عملیاتی" title="آخرین رویدادها" meta="امروز / چرخه ۱۴۰۵" /><div className="operational-timeline">{actions.slice(0, 4).map((action, index) => <div className="timeline-event" key={action.id}><time>{["۰۹:۴۲", "۰۹:۱۸", "۰۸:۵۵", "۰۸:۲۶"][index]}</time><i /><div><strong>{action.department?.label ?? "واحد عملیاتی"}</strong><p>اقدام «{action.title}» اکنون {action.progress}٪ پیشرفت دارد.</p></div></div>)}</div></section>
  </section>;
}

function PanelHeading({ kicker, title, meta }: { kicker: string; title: string; meta: string }) {
  return <div className="executive-panel-head"><div><span className="executive-kicker">{kicker}</span><h2>{title}</h2></div><span className="panel-meta">{meta}</span></div>;
}

function MetricTile({ href, label, value, detail, tone }: { href: string; label: string; value: number | string; detail: string; tone: string }) {
  return <Link href={href} className={`executive-kpi metric-tile ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></Link>;
}

function AttentionGroup({ title, tone, items }: { title: string; tone: string; items: Array<{ id: string; title: string; owner: string; progress: number; status: string }> }) {
  return <div className={`attention-group ${tone}`}><h3><i />{title}</h3>{items.length === 0 ? <p className="attention-empty">موردی برای نمایش نیست</p> : items.map((item) => <Link className="attention-item" href={`/actions/${encodeURIComponent(item.id)}`} key={item.id}><strong>{item.title}</strong><span>{item.owner} · {item.status}</span><b>{item.progress}٪ پیشرفت</b></Link>)}</div>;
}

function EmptyProgramState() {
  return <section className="panel program-empty-state"><span className="program-panel-kicker">داده زنده برنامه</span><h2>هنوز هدفی برای این برنامه ثبت نشده است</h2><p>پس از افزودن نخستین هدف، زنجیره هم‌راستایی در اینجا نمایش داده می‌شود.</p></section>;
}

function SummaryMetric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) {
  return <div className={`strategic-metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
