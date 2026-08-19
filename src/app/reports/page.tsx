"use client";

import { useEffect, useMemo, useState } from "react";
import { PulseShell } from "../../components/PulseShell";

type Report = {
  evaluationState: "PASS" | "WARNING" | "BLOCKED";
  summary: {
    goals: number;
    objectives: number;
    activities: number;
    actions: number;
    eligibleAssignments: number;
    governedFindings: number;
    qualityScore: number;
  };
  rows: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    progress: number;
    goalId?: string;
    eligibleAssignmentIds: string[];
  }>;
  findings: Array<{ ruleId: string; severity: string; reason: string }>;
  legacyCompatibilityMetrics: Array<{ name: string; value: number | string }>;
};

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [filters, setFilters] = useState({ goal: "", status: "" });
  const generatedAt = useMemo(() => new Date().toISOString(), []);
  const query = useMemo(() => new URLSearchParams({
    mode: "governed",
    generatedAt,
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value))
  }).toString(), [filters, generatedAt]);

  useEffect(() => {
    void fetch(`/api/reports?${query}`)
      .then((response) => response.json())
      .then(setReport);
  }, [query]);

  const exportUrl = (format: string) => `/api/reports/export?format=${format}&${query}`;
  const stateLabel = report?.evaluationState ?? "—";

  return (
    <PulseShell>
      <div className="page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">گزارش‌گیری مدیریتی</div>
            <h1>گزارش عملیاتی حاکمیتی</h1>
            <p>نمای خواندنی و deterministic بر مبنای ارزیابی governed برنامه ۱۴۰۵</p>
          </div>
          <div className="top-actions">
            <a className="secondary-button" href={exportUrl("pdf")}>خروجی PDF</a>
            <a className="primary-button" href={exportUrl("xlsx")}>خروجی XLSX</a>
          </div>
        </div>

        <div className="panel report-filters">
          <label>هدف
            <select value={filters.goal} onChange={(event) => setFilters((current) => ({ ...current, goal: event.target.value }))}>
              <option value="">همه اهداف</option>
              {Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={`G${String(index + 1).padStart(2, "0")}`}>G{String(index + 1).padStart(2, "0")}</option>)}
            </select>
          </label>
          <label>وضعیت
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">همه وضعیت‌ها</option>
              <option value="در حال اجرا">در حال اجرا</option>
              <option value="تکمیل شده">تکمیل شده</option>
              <option value="مسدود">مسدود</option>
              <option value="شروع نشده">شروع نشده</option>
            </select>
          </label>
        </div>

        {report && (
          <>
            <div className="panel">
              <div className="panel-head">
                <h2>وضعیت ارزیابی: {stateLabel}</h2>
                <span>گزارش حاکمیتی / فقط خواندنی</span>
              </div>
            </div>
            <div className="score-grid">
              {Object.entries({
                goals: "اهداف",
                objectives: "اهداف جزئی",
                activities: "فعالیت‌ها",
                actions: "اقدامات",
                eligibleAssignments: "تخصیص‌های مجاز",
                governedFindings: "یافته‌های حاکمیتی",
                qualityScore: "امتیاز کیفیت"
              }).map(([key, label]) => (
                <div className="stat-card" key={key}>
                  <div className="card-title">{label}</div>
                  <div className="stat-value">
                    {report.summary[key as keyof Report["summary"]]}{key === "qualityScore" ? "٪" : ""}
                  </div>
                </div>
              ))}
            </div>
            <div className="panel full-panel">
              <div className="panel-head">
                <h2>جدول governed</h2>
                <span>فقط facts عبورکرده از ۱۰C/۱۰D</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>شناسه</th><th>عنوان</th><th>نوع</th><th>وضعیت</th><th>پیشرفت</th><th>هدف</th><th>تخصیص مجاز</th></tr></thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.id}</td><td>{row.title}</td><td>{row.type}</td><td>{row.status}</td>
                        <td>{row.progress}٪</td><td>{row.goalId ?? "—"}</td>
                        <td>{row.eligibleAssignmentIds.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head"><h2>یافته‌های governed</h2></div>
              {report.findings.map((finding) => (
                <div className="report-row" key={`${finding.ruleId}:${finding.reason}`}>
                  <strong>{finding.ruleId}</strong><span>{finding.severity}</span><b>{finding.reason}</b>
                </div>
              ))}
            </div>
            {report.legacyCompatibilityMetrics.length > 0 && (
              <div className="panel">
                <div className="panel-head"><h2>LEGACY / NON-GOVERNED</h2></div>
                {report.legacyCompatibilityMetrics.map((metric) => (
                  <div className="report-row" key={metric.name}>
                    <strong>{metric.name}</strong><span>{metric.value}</span><b>NON-GOVERNED</b>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PulseShell>
  );
}
