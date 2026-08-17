"use client";

import { useEffect, useMemo, useState } from "react";
import { currentPlanDate, goals, type ActionStatus, type Health } from "../lib/data";
import { isOverdue, validateWorkItem } from "../lib/domain";

const icons: Record<string, string> = { داشبورد: "⌂", اهداف: "◎", واحدها: "▦", اقدامات: "✓", شاخص‌ها: "◈", ریسک‌ها: "△", گزارش‌ها: "▤" };
const statusClass: Record<string, string> = { سبز: "green", زرد: "yellow", قرمز: "red", خاکستری: "gray", "در حال اجرا": "running", "مسدود": "blocked", "تکمیل شده": "done", "شروع نشده": "not-started" };
type AppAction = { publicId: string; goalId: string; title: string; workType: "پروژه" | "اقدام" | "فعالیت تکرارشونده"; departmentId: string; ownerPersonId: string; owner: string; department: string; status: ActionStatus; progress: number; deadline: string; deliverable: string };
type DashboardPayload = {
  goals: Array<{ id: string; title: string; progress: number; health: string; actionCount: number }>;
  departments: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
  kpis: Array<Record<string, unknown>>;
  risks: Array<Record<string, unknown>>;
  dependencies: Array<Record<string, unknown>>;
  score: { total: number; goalProgress: number; kpiHealth: number; executionControl: number };
  quality: Record<string, number>;
};

export default function Home() {
  const [active, setActive] = useState("داشبورد");
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<AppAction[]>([]);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [editingAction, setEditingAction] = useState<AppAction | null>(null);
  const [loadError, setLoadError] = useState("");
  const filteredActions = useMemo(() => items.filter((a) => `${a.title} ${a.owner} ${a.department}`.includes(query)), [items, query]);
  const addAction = async (item: AppAction): Promise<string | null> => {
    try {
      const response = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
      const body = await response.json();
      if (!response.ok) return body.error ?? "ثبت اقدام انجام نشد.";
      const refreshed = await fetch("/api/dashboard");
      if (refreshed.ok) {
        const payload = await refreshed.json() as DashboardPayload;
        setDashboard(payload);
        setItems(payload.actions.map(mapAction));
      } else setItems((current) => [...current, mapAction(body)]);
      return null;
    } catch { return "ارتباط با سامانه برقرار نشد."; }
  };
  const updateAction = async (publicId: string, changes: { progress: number; status: ActionStatus }): Promise<string | null> => {
    try {
      const response = await fetch(`/api/actions/${publicId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
      const body = await response.json();
      if (!response.ok) return body.error ?? "به‌روزرسانی اقدام انجام نشد.";
      const refreshed = await fetch("/api/dashboard");
      if (refreshed.ok) {
        const payload = await refreshed.json() as DashboardPayload;
        setDashboard(payload);
        setItems(payload.actions.map(mapAction));
      }
      setEditingAction(null);
      return null;
    } catch { return "ارتباط با سامانه برقرار نشد."; }
  };
  useEffect(() => {
    fetch("/api/dashboard").then(async (response) => {
      if (!response.ok) throw new Error("dashboard");
      const body = await response.json() as DashboardPayload;
      setDashboard(body);
      setItems(body.actions.map(mapAction));
    }).catch(() => setLoadError("بارگذاری اطلاعات سامانه انجام نشد."));
  }, []);
  if (loadError) return <main className="app-shell"><div className="empty-page"><h1>خطا در بارگذاری اطلاعات</h1><p>{loadError}</p><button className="primary-button" onClick={() => window.location.reload()}>تلاش دوباره</button></div></main>;
  if (!dashboard) return <main className="app-shell"><div className="empty-page"><h1>در حال بارگذاری PULSE</h1><p>در حال دریافت اطلاعات عملیاتی از سامانه...</p></div></main>;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">P</div><div><strong>PULSE</strong><span>چرب شیمی</span></div></div>
        <div className="workspace-label">فضای کاری مدیریت</div>
        <nav>{Object.keys(icons).map((item) => <button key={item} className={active === item ? "nav-item active" : "nav-item"} onClick={() => setActive(item)}><span className="nav-icon">{icons[item]}</span>{item}<span className="nav-chevron">‹</span></button>)}</nav>
        <div className="sidebar-bottom"><div className="support-card"><span className="support-dot" /> وضعیت سامانه <strong>عملیاتی</strong></div><div className="user-card"><div className="avatar">م</div><div><strong>مدیر سامانه</strong><span>مدیریت ارشد</span></div><span className="dots">•••</span></div></div>
      </aside>
      <section className="content">
        <header className="topbar"><div className="breadcrumbs">مدیریت عملکرد <span>‹</span> {active}</div><div className="top-actions"><div className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجو در PULSE..." /></div><button className="icon-button">♧<i /></button><button className="date-chip">۱۴۰۵/۰۶/۱۵ <span>⌄</span></button></div></header>
        {active === "داشبورد" ? <Dashboard dashboard={dashboard} items={items} onGoal={setSelectedGoal} onAdd={() => setShowForm(true)} /> : <SectionView title={active} dashboard={dashboard} items={items} onAdd={() => setShowForm(true)} onEdit={(id) => setEditingAction(items.find((item) => item.publicId === id) ?? null)} query={query} />}
      </section>
      {selectedGoal && <GoalDrawer id={selectedGoal} dashboard={dashboard} items={items} onClose={() => setSelectedGoal(null)} />}
      {showForm && <ActionForm goalOptions={dashboard.goals} onSubmit={addAction} onClose={() => setShowForm(false)} />}
      {editingAction && <ActionEdit action={editingAction} onSubmit={updateAction} onClose={() => setEditingAction(null)} />}
    </main>
  );
}

function mapAction(row: Record<string, unknown>): AppAction {
  return {
    publicId: String(row.public_id ?? row.publicId),
    goalId: String(row.goal_id ?? row.goalId),
    title: String(row.title),
    workType: row.work_type as AppAction["workType"],
    departmentId: String(row.department_id ?? row.departmentId),
    ownerPersonId: String(row.owner_person_id ?? row.ownerPersonId),
    owner: String(row.owner ?? ""),
    department: String(row.department ?? ""),
    status: row.status as ActionStatus,
    progress: Number(row.progress),
    deadline: String(row.planned_end ?? row.deadline),
    deliverable: String(row.deliverable)
  };
}

function Dashboard({ dashboard, items, onGoal, onAdd }: { dashboard: DashboardPayload; items: readonly AppAction[]; onGoal: (id: string) => void; onAdd: () => void }) {
  const score = dashboard.score;
  const quality = dashboard.quality;
  const activeCount = items.filter((item) => item.status !== "لغو شده").length;
  const attentionCount = (quality.overdue ?? 0) + items.filter((item) => item.status === "مسدود").length;
  const criticalRisks = dashboard.risks.filter((risk) => Number(risk.probability) * Number(risk.impact) >= 15 && risk.status === "باز").length;
  return <div className="page"><div className="page-heading"><div><div className="eyebrow">دوشنبه، ۲۶ مرداد ۱۴۰۵</div><h1>صبح بخیر، مدیر عزیز <span>✦</span></h1><p>این نمای کلی، نبض اجرای برنامه‌های چرب شیمی را نشان می‌دهد.</p></div><button className="primary-button" onClick={onAdd}>＋ ثبت اقدام جدید</button></div>
    <div className="score-grid"><div className="score-card"><div className="card-title">شاخص نبض شرکت <span className="help">?</span></div><div className="score-content"><div className="score-ring"><strong>{score.total}</strong><span>از ۱۰۰</span></div><div className="score-notes"><div><b className="green-text">محاسبه‌شده</b> از داده‌های عملیاتی</div><small>۶ مؤلفه قابل ردیابی</small></div></div><div className="score-bars"><ScoreBar label="پیشرفت اهداف" value={score.goalProgress} color="green" /><ScoreBar label="سلامت KPIها" value={score.kpiHealth} color="green" /><ScoreBar label="کنترل اقدامات" value={score.executionControl} color="yellow" /></div></div>
      <StatCard label="اقدامات فعال" value={String(activeCount)} detail={`از ${items.length} اقدام ثبت‌شده`} trend="داده واقعی" color="purple" icon="✓" /><StatCard label="نیازمند توجه" value={String(attentionCount)} detail={`${quality.overdue} عقب‌افتاده · ${items.filter((item) => item.status === "مسدود").length} مسدود`} trend="قابل پیگیری" color="red" icon="!" /><StatCard label="ریسک‌های بحرانی" value={String(criticalRisks)} detail={`${dashboard.risks.length} ریسک ثبت‌شده`} trend="شدت محاسبه‌شده" color="yellow" icon="△" /></div>
    <div className="section-row"><div className="panel goals-panel"><PanelHead title="پیشرفت اهداف کلان" action="مشاهده همه اهداف" /><div className="goal-list">{dashboard.goals.map((goal) => <button className="goal-row" key={goal.id} onClick={() => onGoal(goal.id)}><span className="goal-id">{goal.id}</span><span className="goal-title">{goal.title}</span><span className="mini-progress"><i style={{ width: `${goal.progress}%` }} className={statusClass[goal.health]} /></span><b>{goal.progress}٪</b><span className={`status-dot ${statusClass[goal.health]}`} /></button>)}</div></div><div className="panel units-panel"><PanelHead title="وضعیت واحدها" action="جزئیات واحدها" /><div className="unit-list">{dashboard.departments.slice(0, 5).map((department) => <div className="unit-row" key={String(department.id)}><div className={`unit-icon ${statusClass[String(department.health)]}`}>{String(department.name).slice(0, 1)}</div><div className="unit-info"><strong>{String(department.name)}</strong><span>{String(department.actionCount)} اقدام <em>•</em> {String(department.attentionCount)} مورد نیازمند توجه</span></div><div className="unit-value"><b>{String(department.progress)}٪</b><span className={`status-pill ${statusClass[String(department.health)]}`}>{String(department.health)}</span></div></div>)}</div></div></div>
    <div className="section-row lower"><div className="panel actions-panel"><PanelHead title="اقدامات نیازمند توجه" action="مشاهده همه اقدامات" /><div className="table-wrap"><table><thead><tr><th>اقدام</th><th>مسئول</th><th>موعد</th><th>وضعیت</th><th>پیشرفت</th></tr></thead><tbody>{items.filter((a) => a.status === "مسدود" || isOverdue(a.deadline, currentPlanDate, a.status)).slice(0, 4).map((a) => <tr key={a.publicId}><td><strong>{a.title}</strong><small>{a.publicId}</small></td><td>{a.owner}</td><td className={isOverdue(a.deadline, currentPlanDate, a.status) ? "red-text" : ""}>{a.deadline}</td><td><span className={`status-pill ${statusClass[a.status]}`}>{a.status}</span></td><td><div className="table-progress"><i style={{ width: `${a.progress}%` }} /><b>{a.progress}٪</b></div></td></tr>)}</tbody></table></div></div><div className="panel kpi-panel"><PanelHead title="سلامت شاخص‌ها" action="مرور KPIها" /><div className="kpi-list">{dashboard.kpis.map((kpi) => <div className="kpi-row" key={String(kpi.id)}><div className="kpi-symbol">◈</div><div><strong>{String(kpi.name)}</strong><span>داده ثبت‌شده در سامانه</span></div><div className="kpi-numbers"><b>{String(kpi.actual)}٪</b><span>هدف {String(kpi.target)}٪</span></div><span className={`status-dot ${statusClass[String(kpi.health)]}`} /></div>)}</div></div></div>
  </div>;
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) { return <div className="score-bar"><span>{label}</span><div><i className={color} style={{ width: `${value}%` }} /></div><b>{value}٪</b></div>; }
function StatCard({ label, value, detail, trend, color, icon }: { label: string; value: string; detail: string; trend: string; color: string; icon: string }) { return <div className="stat-card"><div className={`stat-icon ${color}`}>{icon}</div><div className="card-title">{label}</div><div className="stat-value">{value}</div><div className="stat-footer"><span>{detail}</span><b className={color === "red" ? "red-text" : "green-text"}>{trend}</b></div></div>; }
function PanelHead({ title, action }: { title: string; action: string }) { return <div className="panel-head"><h2>{title}</h2><button>{action} <span>‹</span></button></div>; }

function SectionView({ title, dashboard, items, onAdd, onEdit, query }: { title: string; dashboard: DashboardPayload; items: readonly AppAction[]; onAdd: () => void; onEdit: (id: string) => void; query: string }) {
  const list = title === "اهداف" ? dashboard.goals.map((goal) => ({ id: goal.id, title: goal.title, owner: "مدیریت ارشد", department: "چرب شیمی", status: "در حال اجرا", progress: goal.progress, health: goal.health })) : items.filter((a) => `${a.title} ${a.owner} ${a.department}`.includes(query)).map((a) => ({ ...a, id: a.publicId, health: isOverdue(a.deadline, currentPlanDate, a.status) ? "قرمز" : "سبز" }));
  return <div className="page"><div className="page-heading"><div><div className="eyebrow">مدیریت یکپارچه عملکرد</div><h1>{title}</h1><p>اطلاعات عملیاتی به‌روز برای تصمیم‌گیری سریع و دقیق.</p></div><button className="primary-button" onClick={onAdd}>＋ ثبت اقدام جدید</button></div><div className="panel full-panel"><PanelHead title={`${title} فعال`} action="خروجی گزارش" /><div className="big-list">{list.map((item) => <div className="big-row" key={item.id}><span className="goal-id">{item.id}</span><div><strong>{item.title}</strong><span>{item.department} <em>•</em> {item.owner}</span></div><div className="row-progress"><div><i style={{ width: `${item.progress}%` }} className={statusClass[item.health]} /></div><b>{item.progress}٪</b></div><span className={`status-pill ${statusClass[item.status] || statusClass[item.health]}`}>{item.status}</span>{title !== "اهداف" && <button className="row-edit" onClick={() => onEdit(item.id)}>ویرایش</button>}</div>)}</div></div></div>;
}

function GoalDrawer({ id, dashboard, items, onClose }: { id: string; dashboard: DashboardPayload; items: readonly AppAction[]; onClose: () => void }) { const goal = dashboard.goals.find((item) => item.id === id); const related = items.filter((a) => a.goalId === id); return <div className="overlay"><div className="drawer"><button className="close" onClick={onClose}>×</button><div className="drawer-label">هدف کلان</div><h2><span>{goal?.id}</span> {goal?.title}</h2><div className="drawer-score"><b>{goal?.progress}٪</b><span>پیشرفت تحقق هدف</span><div><i style={{ width: `${goal?.progress ?? 0}%` }} /></div></div><div className="drawer-meta"><div><span>مالک هدف</span><b>مدیریت ارشد</b></div><div><span>وضعیت</span><b className={`${statusClass[goal?.health || "خاکستری"]}-text`}>{goal?.health}</b></div></div><h3>اقدامات مرتبط <small>{related.length} اقدام</small></h3>{related.length ? related.map((a) => <div className="drawer-action" key={a.publicId}><span className={`status-dot ${isOverdue(a.deadline, currentPlanDate, a.status) ? "red" : "green"}`} /><div><strong>{a.title}</strong><span>{a.owner} · موعد {a.deadline}</span></div><b>{a.progress}٪</b></div>) : <div className="empty">هنوز اقدامی برای این هدف ثبت نشده است.</div>}<button className="primary-button wide" onClick={onClose}>مشاهده صفحه کامل هدف</button></div></div>; }

function ActionForm({ goalOptions, onClose, onSubmit }: { goalOptions: DashboardPayload["goals"]; onClose: () => void; onSubmit: (item: AppAction) => Promise<string | null> }) {
  const [title, setTitle] = useState("");
  const [goalId, setGoalId] = useState("G10");
  const [owner, setOwner] = useState("it-engineer");
  const [deliverable, setDeliverable] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");
  const ownerMap = { "it-engineer": ["مهندس فناوری اطلاعات", "فناوری اطلاعات", "it"], "maintenance-engineer": ["مهندس مکانیک - نت", "نت / نگهداری و تعمیرات", "maintenance"], "production-engineer": ["مهندس شیمی - تولید", "تولید", "production"] } as const;
  const submit = async () => {
    const publicId = `${goalId}-O99-A99-T${String(Date.now()).slice(-3)}`;
    const candidate = { publicId, goalId, title, workType: "اقدام" as const, departmentId: ownerMap[owner as keyof typeof ownerMap][2], ownerPersonId: owner, owner: ownerMap[owner as keyof typeof ownerMap][0], department: ownerMap[owner as keyof typeof ownerMap][1], status: "شروع نشده" as const, progress: 0, deadline, deliverable };
    const validation = validateWorkItem(candidate, new Set(goalOptions.map((goal) => goal.id)));
    if (validation.length) { setError(validation.join(" ")); return; }
    const apiError = await onSubmit(candidate);
    if (apiError) { setError(apiError); return; }
    onClose();
  };
  return <div className="overlay"><div className="modal"><button className="close" onClick={onClose}>×</button><div className="drawer-label">برنامه‌ریزی</div><h2>ثبت اقدام جدید</h2><p className="modal-intro">یک اقدام روشن با مالک، خروجی و موعد مشخص تعریف کنید.</p><div className="form-grid"><label>هدف کلان<select value={goalId} onChange={(event) => setGoalId(event.target.value)}>{goalOptions.map((goal) => <option key={goal.id} value={goal.id}>{goal.id} — {goal.title}</option>)}</select></label><label>هدف جزئی<input placeholder="مثلاً پایش هوشمند انرژی" /></label><label className="wide-field">عنوان اقدام<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="عنوان کوتاه و قابل پیگیری اقدام" /></label><label>مسئول<select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="it-engineer">مهندس فناوری اطلاعات</option><option value="maintenance-engineer">مهندس مکانیک - نت</option><option value="production-engineer">مهندس شیمی - تولید</option></select></label><label>خروجی مورد انتظار<input value={deliverable} onChange={(event) => setDeliverable(event.target.value)} placeholder="خروجی قابل تحویل" /></label><label>تاریخ پایان<input value={deadline} onChange={(event) => setDeadline(event.target.value)} placeholder="۱۴۰۵/۰۷/۱۵" /></label><label>اولویت<select><option>زیاد</option><option>متوسط</option><option>کم</option></select></label></div>{error && <div className="form-error" role="alert">{error}</div>}<div className="form-actions"><button className="secondary-button" onClick={onClose}>انصراف</button><button className="primary-button" onClick={submit}>ثبت اقدام</button></div></div></div>;
}

function ActionEdit({ action, onClose, onSubmit }: { action: AppAction; onClose: () => void; onSubmit: (id: string, changes: { progress: number; status: ActionStatus }) => Promise<string | null> }) {
  const [progress, setProgress] = useState(action.progress);
  const [status, setStatus] = useState<ActionStatus>(action.status);
  const [error, setError] = useState("");
  const submit = async () => {
    const apiError = await onSubmit(action.publicId, { progress, status });
    if (apiError) setError(apiError);
  };
  return <div className="overlay"><div className="modal"><button className="close" onClick={onClose}>×</button><div className="drawer-label">پیگیری اجرا</div><h2>ویرایش اقدام</h2><p className="modal-intro">{action.title}</p><div className="form-grid"><label>وضعیت<select value={status} onChange={(event) => setStatus(event.target.value as ActionStatus)}><option>شروع نشده</option><option>در حال اجرا</option><option>تکمیل شده</option><option>مسدود</option><option>لغو شده</option></select></label><label>پیشرفت<input type="number" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} /></label></div>{error && <div className="form-error" role="alert">{error}</div>}<div className="form-actions"><button className="secondary-button" onClick={onClose}>انصراف</button><button className="primary-button" onClick={submit}>ذخیره تغییرات</button></div></div></div>;
}
