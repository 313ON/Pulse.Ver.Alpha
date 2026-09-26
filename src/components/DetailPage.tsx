"use client";

import { useEffect, useState } from "react";
import { PulseShell } from "./PulseShell";
import { isGoalBriefComplete } from "../domain/program/goal-brief";

export function withGoalSummary(record: Record<string, unknown>, goals: Array<Record<string, unknown>>, id: string): Record<string, unknown> {
  const summary = goals.find((goal) => String(goal.id) === id);
  return summary ? { ...record, progress: summary.progress, health: summary.health, actionCount: summary.actionCount } : record;
}

export function DetailPage({ type, id }: { type: "actions" | "goals"; id: string }) {
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [briefForm, setBriefForm] = useState<Record<string, string>>({ brief: "", strategicRationale: "", expectedOutcome: "", scope: "", successCriteria: "" });
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
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
      if (type === "goals") setBriefForm({ brief: String(body.brief ?? ""), strategicRationale: String(body.strategic_rationale ?? ""), expectedOutcome: String(body.expected_outcome ?? ""), scope: String(body.scope ?? ""), successCriteria: String(body.success_criteria ?? "") });
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "اطلاعات یافت نشد."));
  }, [id, type]);
  async function saveBrief(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");
    try {
      const csrf = await fetch("/api/auth/csrf").then((response) => response.json() as Promise<{ token: string }>);
      const response = await fetch(`/api/goals/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token }, body: JSON.stringify(briefForm) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "ذخیره شناسنامه هدف انجام نشد.");
      setRecord((current) => current ? { ...current, ...body } : body);
      setSaveMessage("شناسنامه هدف ذخیره شد.");
    } catch (reason) {
      setSaveMessage(reason instanceof Error ? reason.message : "ذخیره شناسنامه هدف انجام نشد.");
    } finally {
      setSaving(false);
    }
  }
  const fieldLabels: Record<string, string> = { id: "شناسه", title: "عنوان", plan_year: "سال برنامه", progress: "پیشرفت", health: "سلامت هدف", actionCount: "تعداد اقدامات" };
  const briefFields: Array<[string, string]> = [["brief", "شرح مختصر"], ["strategic_rationale", "منطق راهبردی"], ["expected_outcome", "نتیجه مورد انتظار"], ["scope", "دامنه"], ["success_criteria", "معیارهای موفقیت"]];
  const brief = type === "goals" ? { brief: String(record?.brief ?? ""), strategicRationale: String(record?.strategic_rationale ?? ""), expectedOutcome: String(record?.expected_outcome ?? ""), scope: String(record?.scope ?? ""), successCriteria: String(record?.success_criteria ?? "") } : null;
  return <PulseShell><div className="page"><div className="page-heading"><div><div className="eyebrow">جزئیات و پیگیری</div><h1>{type === "actions" ? "جزئیات اقدام" : "جزئیات هدف"}</h1><p>{id}</p></div></div>{error ? <div className="empty">{error}</div> : !record ? <div className="empty">در حال دریافت اطلاعات...</div> : <>{type === "goals" && brief && <><div className="detail-summary"><div><span>پیشرفت هدف</span><strong>{String(record.progress ?? "۰")}٪</strong></div><div><span>سلامت</span><strong>{String(record.health ?? "خاکستری")}</strong></div><div><span>اقدامات مرتبط</span><strong>{String(record.actionCount ?? "۰")}</strong></div></div><section className="panel goal-brief"><div className="panel-head"><div><span className="eyebrow">Strategic Goal Brief</span><h2>شناسنامه راهبردی هدف</h2></div><span className={`brief-status ${isGoalBriefComplete(brief) ? "complete" : "incomplete"}`}>{isGoalBriefComplete(brief) ? "کامل" : "ناقص؛ منبع معتبر ثبت نشده است"}</span></div><div className="brief-grid">{briefFields.map(([key, label]) => <div className="brief-field" key={key}><span>{label}</span><p>{String(record[key] ?? "اطلاعات ثبت نشده است") || "اطلاعات ثبت نشده است"}</p></div>)}</div>{Boolean(record.brief_source) && <small>منبع: {String(record.brief_source)}</small>}</section><form className="panel goal-brief-editor" onSubmit={saveBrief}><div className="panel-head"><div><span className="eyebrow">نگهداری مجاز</span><h2>ویرایش شناسنامه راهبردی</h2></div><span className="brief-status incomplete">ذخیره با ثبت حساب کاربری</span></div><div className="form-grid">{[["brief","شرح مختصر"],["strategicRationale","منطق راهبردی"],["expectedOutcome","نتیجه مورد انتظار"],["scope","دامنه"],["successCriteria","معیارهای موفقیت"]].map(([key, label]) => <label className="wide-field" key={key}>{label}<textarea maxLength={2000} value={briefForm[key] ?? ""} onChange={(event) => setBriefForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div>{saveMessage && <div className="form-error" role="status">{saveMessage}</div>}<div className="form-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? "در حال ذخیره..." : "ذخیره شناسنامه"}</button></div></form></>}<div className="panel detail-card">{Object.entries(record).filter(([key]) => !(type === "goals" && ["owner_person_id", ...briefFields.map(([field]) => field)].includes(key))).map(([key, value]) => <div className="detail-field" key={key}><span>{fieldLabels[key] ?? key}</span><strong>{String(value ?? "—")}</strong></div>)}</div></>}</div></PulseShell>;
}
