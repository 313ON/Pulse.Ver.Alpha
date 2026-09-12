"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PulseShell } from "../../components/PulseShell";
import { classifyReportState } from "../../components/reporting/report-state";
import { ContextIndicator } from "../../components/program/ContextIndicator";

type Report = {
  planYear: number;
  generatedAt: string;
  authorization: {
    scope: string;
    subjectVisible: boolean;
  };
  provenance: Array<unknown>;
  unresolvedReferences: Array<unknown>;
  historicalEvidence: Array<unknown>;
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
  availableGoals: Array<{ id: string; title: string }>;
};

export default function ReportsPage() {
  const dashboardParams = useSearchParams();
  const [report, setReport] = useState<Report | null>(null);
  const [requestError, setRequestError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  const [filters, setFilters] = useState({ goal: "", status: "" });
  const generatedAt = useMemo(() => new Date().toISOString(), []);
  const query = useMemo(() => new URLSearchParams({
    mode: "governed",
    generatedAt,
    ...(dashboardParams.get("planCycle") ? { planCycle: dashboardParams.get("planCycle")! } : {}),
    ...(dashboardParams.get("unit") ? { unit: dashboardParams.get("unit")! } : {}),
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value))
  }).toString(), [dashboardParams, filters, generatedAt]);

  useEffect(() => {
    const controller = new AbortController();
    setReport(null);
    setRequestError("");
    void fetch(`/api/reports?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as Report & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "دریافت گزارش انجام نشد.");
        return body;
      })
      .then(setReport)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRequestError(error instanceof Error ? error.message : "دریافت گزارش انجام نشد.");
      });
    return () => controller.abort();
  }, [query, requestVersion]);

  const exportUrl = (format: string) => `/api/reports/export?format=${format}&${query}`;
  const viewState = classifyReportState(report, requestError);
  const stateLabel = report?.evaluationState ?? "—";
  const findingKeyCounts = new Map<string, number>();

  return (
    <PulseShell>
      <div className="page reports-page">
        {(dashboardParams.get("planCycle") || dashboardParams.get("unit")) && <ContextIndicator context={{ planYear: Number(dashboardParams.get("planCycle")) || report?.planYear || 0, organizationalUnitId: dashboardParams.get("unit") || "ALL" }} unitLabel={dashboardParams.get("unit") === "ALL" || !dashboardParams.get("unit") ? "همه واحدها" : `واحد ${dashboardParams.get("unit")}`} />}
        <div className="page-heading">
          <div>
            <div className="eyebrow">گزارش‌گیری مدیریتی</div>
            <h1>گزارش عملیاتی حاکمیتی</h1>
            <p>نمای خواندنی و deterministic بر مبنای ارزیابی governed برنامه جاری</p>
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
              {(report?.availableGoals ?? []).map((goal) => <option key={goal.id} value={goal.id}>{goal.id} · {goal.title}</option>)}
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

        {viewState.kind === "loading" && <div className="panel report-state-card" role="status" aria-live="polite"><strong>در حال تولید گزارش حاکمیتی…</strong><span>داده‌های مجاز و شواهد گزارش در حال دریافت است.</span></div>}

        {viewState.kind === "error" && <div className="panel report-state-card error" role="alert"><strong>دریافت گزارش انجام نشد.</strong><span>{viewState.message}</span><button className="primary-button" type="button" onClick={() => setRequestVersion((current) => current + 1)}>تلاش دوباره</button></div>}

        {viewState.kind === "empty" && <div className="panel report-state-card empty" role="status"><strong>داده قابل گزارشی برای این محدوده وجود ندارد.</strong><span>فیلترها یا زمینه برنامه را تغییر دهید، یا پس از تکمیل داده‌های governed دوباره تلاش کنید.</span></div>}

        {(viewState.kind === "success" || viewState.kind === "empty") && report && (
          <>
            <div className="panel">
              <div className="panel-head">
                <h2>وضعیت ارزیابی: {stateLabel}</h2>
                <span>گزارش حاکمیتی / فقط خواندنی</span>
              </div>
            </div>
            <div className="panel report-evidence">
              <div className="panel-head">
                <h2>شواهد و مرز دسترسی</h2>
                <span>منبع همان گزارش governed</span>
              </div>
              <div className="report-evidence-grid">
                <div><span>سال برنامه</span><strong>{report.planYear}</strong></div>
                <div><span>محدوده کاربر</span><strong>{report.authorization.scope}</strong></div>
                <div><span>موضوع قابل مشاهده</span><strong>{report.authorization.subjectVisible ? "بله" : "خیر"}</strong></div>
                <div><span>منابع ردیابی</span><strong>{report.provenance.length}</strong></div>
                <div><span>ارجاع‌های حل‌نشده</span><strong>{report.unresolvedReferences.length}</strong></div>
                <div><span>شواهد تاریخی</span><strong>{report.historicalEvidence.length}</strong></div>
              </div>
              <small className="report-generated-at">تولید شده در {report.generatedAt}</small>
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
                  <caption className="sr-only">جدول اقلام گزارش governed</caption>
                  <thead><tr><th scope="col">شناسه</th><th scope="col">عنوان</th><th scope="col">نوع</th><th scope="col">وضعیت</th><th scope="col">پیشرفت</th><th scope="col">هدف</th><th scope="col">تخصیص مجاز</th></tr></thead>
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
              {report.findings.map((finding) => {
                const baseKey = `${finding.ruleId}:${finding.severity}:${finding.reason}`;
                const occurrence = findingKeyCounts.get(baseKey) ?? 0;
                findingKeyCounts.set(baseKey, occurrence + 1);
                return (
                <div className="report-row" key={`${baseKey}:${occurrence}`}>
                  <strong>{finding.ruleId}</strong><span>{finding.severity}</span><b>{finding.reason}</b>
                </div>
                );
              })}
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
