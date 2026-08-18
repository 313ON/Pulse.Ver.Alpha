"use client";

import { useEffect, useState } from "react";
import { PulseShell } from "./PulseShell";

const endpoints: Record<string, string> = { activities: "/api/activities", departments: "/api/departments", roles: "/api/roles", persons: "/api/persons", users: "/api/users" };
const fields: Record<string, Array<[string, string]>> = {
  activities: [["subGoalId", "شناسه زیرهدف"], ["title", "عنوان"], ["description", "شرح"], ["ownerPersonId", "شناسه مسئول"]],
  departments: [["name", "نام واحد"], ["active", "فعال"]],
  roles: [["title", "عنوان سمت"], ["departmentId", "شناسه واحد"]],
  persons: [["fullName", "نام و نام خانوادگی"], ["seatId", "شناسه سمت"], ["active", "فعال"]],
  users: [["username", "نام کاربری"], ["password", "گذرواژه جدید"], ["roleId", "شناسه نقش"], ["departmentId", "شناسه واحد"], ["active", "فعال"]]
};

export function RecordDetailPage({ section, id }: { section: string; id: string }) {
  const endpoint = endpoints[section] ?? endpoints.departments;
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  useEffect(() => { fetch(`${endpoint}/${encodeURIComponent(id)}`).then((response) => response.json()).then((body) => { setRecord(body); setForm(Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value ?? "")]))); }).catch(() => setMessage("اطلاعات دریافت نشد.")); }, [endpoint, id]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const payload: Record<string, unknown> = { ...form, active: form.active === "1" || form.active === "true" };
    if (!String(payload.password ?? "")) delete payload.password;
    const csrf = await fetch("/api/auth/csrf").then((response) => response.json());
    const response = await fetch(`${endpoint}/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token }, body: JSON.stringify(payload) });
    const body = await response.json();
    setMessage(response.ok ? "تغییرات ذخیره شد." : body.error ?? "ذخیره انجام نشد.");
    if (response.ok) setRecord(body);
  }
  return <PulseShell><div className="page"><div className="page-heading"><div><div className="eyebrow">جزئیات و ویرایش</div><h1>{section} — {id}</h1></div></div>{!record ? <div className="empty">در حال دریافت اطلاعات...</div> : <div className="panel"><form onSubmit={save}><div className="form-grid">{(fields[section] ?? []).map(([key, label]) => <label key={key}>{label}<input type={key === "password" ? "password" : "text"} value={form[key] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div>{message && <div className="form-error">{message}</div>}<div className="form-actions"><button className="primary-button">ذخیره تغییرات</button></div></form></div>}</div></PulseShell>;
}
