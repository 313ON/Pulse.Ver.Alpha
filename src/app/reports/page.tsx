"use client";

import { useEffect, useMemo, useState } from "react";
import { PulseShell } from "../../components/PulseShell";

type Report = {
  summary: Record<string, number>;
  departments: Array<Record<string, unknown>>;
  goals: Array<Record<string, unknown>>;
  monthlyTrend: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
};

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [filters, setFilters] = useState({ goal: "", department: "", status: "", overdue: "" });
  const query = useMemo(() => new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString(), [filters]);
  const load = () => fetch(`/api/reports?${query}`).then((response) => response.json()).then(setReport);
  useEffect(() => { void load(); }, [query]);
  const exportUrl = (format: string) => `/api/reports/export?format=${format}&${query}`;
  return <PulseShell><div className="page"><div className="page-heading"><div><div className="eyebrow">گزارش‌گیری مدیریتی</div><h1>گزارش وضعیت برنامه سالانه</h1><p>گزارش زنده بر اساس اطلاعات ذخیره‌شده سامانه و فیلترهای انتخاب‌شده</p></div><div className="top-actions"><a className="secondary-button" href={exportUrl("pdf")}>خروجی PDF</a><a className="primary-button" href={exportUrl("xlsx")}>خروجی XLSX</a></div></div>
    <div className="panel report-filters"><label>هدف<select value={filters.goal} onChange={(event) => setFilters((current) => ({ ...current, goal: event.target.value }))}><option value="">همه اهداف</option>{Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={`G${String(index + 1).padStart(2, "0")}`}>G{String(index + 1).padStart(2, "0")}</option>)}</select></label><label>واحد<input value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))} placeholder="شناسه واحد" /></label><label>وضعیت<select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">همه وضعیت‌ها</option><option value="در حال اجرا">در حال اجرا</option><option value="تکمیل شده">تکمیل شده</option><option value="مسدود">مسدود</option><option value="شروع نشده">شروع نشده</option></select></label><label>معوق<select value={filters.overdue} onChange={(event) => setFilters((current) => ({ ...current, overdue: event.target.value }))}><option value="">همه</option><option value="true">فقط معوق</option></select></label></div>
    <div className="score-grid">{report && Object.entries({ totalGoals: "تعداد اهداف", totalActions: "تعداد اقدامات", completionPercentage: "درصد تکمیل", overdueActions: "اقدامات معوق", highRisks: "ریسک‌های مهم", unresolvedDependencies: "وابستگی‌های حل‌نشده", averageProgress: "میانگین پیشرفت" }).map(([key, label]) => <div className="stat-card" key={key}><div className="card-title">{label}</div><div className="stat-value">{report.summary[key] ?? 0}{key.includes("Percentage") || key === "averageProgress" ? "٪" : ""}</div></div>)}</div>
    {report && <><div className="section-row"><div className="panel"><div className="panel-head"><h2>عملکرد واحدها</h2></div>{report.departments.map((item) => <div className="report-row" key={String(item.id)}><strong>{String(item.name)}</strong><span>{String(item.action_count)} اقدام</span><b>{String(item.progress)}٪</b></div>)}</div><div className="panel"><div className="panel-head"><h2>عملکرد اهداف</h2></div>{report.goals.map((item) => <div className="report-row" key={String(item.id)}><strong>{String(item.id)} — {String(item.title)}</strong><span>{String(item.action_count)} اقدام</span><b>{String(item.progress)}٪</b></div>)}</div></div><div className="panel"><div className="panel-head"><h2>روند ماهانه</h2></div><div className="trend-row">{report.monthlyTrend.map((item) => <span key={String(item.month)}><b>{String(item.progress)}٪</b><small>{String(item.month)}</small></span>)}</div></div><div className="panel full-panel"><div className="panel-head"><h2>جزئیات اقدامات</h2></div><div className="table-wrap"><table><thead><tr><th>شناسه</th><th>عنوان</th><th>هدف</th><th>واحد</th><th>مسئول</th><th>وضعیت</th><th>پیشرفت</th><th>موعد</th></tr></thead><tbody>{report.actions.map((action) => <tr key={String(action.public_id)}><td>{String(action.public_id)}</td><td>{String(action.title)}</td><td>{String(action.goal_id)}</td><td>{String(action.department)}</td><td>{String(action.owner)}</td><td>{String(action.status)}</td><td>{String(action.progress)}٪</td><td>{String(action.planned_end)}</td></tr>)}</tbody></table></div></div></>}
  </div></PulseShell>;
}
