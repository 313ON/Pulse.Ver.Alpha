"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PulseShell } from "./PulseShell";

type Row = Record<string, unknown>;
const config: Record<string, { title: string; endpoint: string; columns: Array<[string, string]> }> = {
  goals: { title: "اهداف", endpoint: "/api/goals", columns: [["id", "شناسه"], ["title", "عنوان"]] },
  activities: { title: "فعالیت‌ها", endpoint: "/api/activities", columns: [["id", "شناسه"], ["title", "عنوان"], ["sub_goal_id", "زیرهدف"], ["owner", "مسئول"], ["activity_action_count", "اقدامات مرتبط"]] },
  departments: { title: "واحدها", endpoint: "/api/departments", columns: [["id", "شناسه"], ["name", "نام واحد"], ["active", "وضعیت"]] },
  roles: { title: "سمت‌ها و نقش‌ها", endpoint: "/api/roles", columns: [["id", "شناسه"], ["title", "عنوان"], ["department_id", "واحد"]] },
  persons: { title: "پرسنل", endpoint: "/api/persons", columns: [["id", "شناسه"], ["full_name", "نام"], ["seat_id", "سمت"]] },
  users: { title: "کاربران سامانه", endpoint: "/api/users", columns: [["id", "شناسه"], ["username", "نام کاربری"], ["role", "نقش"], ["active", "وضعیت"]] },
  actions: { title: "اقدامات", endpoint: "/api/actions", columns: [["public_id", "شناسه اقدام"], ["title", "عنوان"], ["status", "وضعیت"], ["progress", "پیشرفت"], ["planned_end", "موعد"]] },
  kpis: { title: "شاخص‌ها", endpoint: "/api/kpis", columns: [["id", "شناسه"], ["name", "نام شاخص"], ["actual", "مقدار فعلی"], ["target", "هدف"]] },
  risks: { title: "ریسک‌ها", endpoint: "/api/risks", columns: [["id", "شناسه"], ["title", "عنوان"], ["severity", "شدت"], ["status", "وضعیت"]] },
  dependencies: { title: "وابستگی‌ها", endpoint: "/api/dependencies", columns: [["id", "شناسه"], ["source_work_item_id", "مبدأ"], ["target_work_item_id", "مقصد"], ["status", "وضعیت"]] }
};

export function ManagementPage({ section }: { section: string }) {
  const entry = config[section] ?? config.actions;
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch(entry.endpoint).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "خطا در دریافت اطلاعات");
      setRows(Array.isArray(body) ? body : body.data ?? []);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "خطا در دریافت اطلاعات"));
  }, [entry.endpoint]);
  const filtered = useMemo(() => rows.filter((row) => JSON.stringify(row).toLocaleLowerCase("fa").includes(query.toLocaleLowerCase("fa"))), [rows, query]);
  const fields = section === "goals" ? [["id", "شناسه هدف"], ["title", "عنوان"]] : section === "activities" ? [["id", "شناسه فعالیت"], ["subGoalId", "شناسه زیرهدف"], ["title", "عنوان"], ["description", "شرح"], ["ownerPersonId", "شناسه مسئول"]] : section === "departments" ? [["id", "شناسه واحد"], ["name", "نام واحد"]] : section === "roles" ? [["id", "شناسه سمت"], ["title", "عنوان سمت"], ["departmentId", "شناسه واحد"]] : section === "persons" ? [["id", "شناسه پرسنل"], ["fullName", "نام و نام خانوادگی"], ["seatId", "شناسه سمت"]] : section === "users" ? [["id", "شناسه کاربر"], ["username", "نام کاربری"], ["password", "گذرواژه"], ["roleId", "شناسه نقش"]] : [];
  async function createRecord(event: React.FormEvent) {
    event.preventDefault();
    const csrf = await fetch("/api/auth/csrf").then((response) => response.json());
    const response = await fetch(entry.endpoint, { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token }, body: JSON.stringify(form) });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "ثبت اطلاعات انجام نشد."); return; }
    setRows((current) => [...current, body]); setForm({}); setShowCreate(false); setError("");
  }
  return <PulseShell><div className="page">
    <div className="page-heading"><div><div className="eyebrow">مدیریت اطلاعات پایه و اجرا</div><h1>{entry.title}</h1><p>مشاهده، جستجو و کنترل اطلاعات ثبت‌شده در سامانه</p></div>{fields.length > 0 && <button className="primary-button" onClick={() => setShowCreate(true)}>＋ ثبت مورد جدید</button>}</div>
    {showCreate && <div className="panel create-panel"><form onSubmit={createRecord}><div className="form-grid">{fields.map(([key, label]) => <label key={key}>{label}<input required value={form[key] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div><div className="form-actions"><button className="primary-button" type="submit">ذخیره</button><button className="secondary-button" type="button" onClick={() => setShowCreate(false)}>انصراف</button></div></form></div>}
    <div className="panel full-panel">
      <div className="panel-head"><h2>{entry.title}</h2><label className="inline-search">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجو..." /></label></div>
      {error ? <div className="empty">{error}</div> : <div className="table-wrap"><table><thead><tr>{entry.columns.map(([, label]) => <th key={label}>{label}</th>)}<th>عملیات</th></tr></thead><tbody>{filtered.map((row, index) => { const id = String(row.id ?? row.public_id ?? index); return <tr key={id}>{entry.columns.map(([key]) => <td key={key}>{key === "active" ? (row[key] ? "فعال" : "غیرفعال") : String(row[key] ?? "—")}</td>)}<td><Link className="table-action" href={`/${section}/${encodeURIComponent(id)}`}>مشاهده جزئیات</Link></td></tr>; })}</tbody></table>{filtered.length === 0 && <div className="empty">موردی برای نمایش وجود ندارد.</div>}</div>}
    </div>
  </div></PulseShell>;
}
