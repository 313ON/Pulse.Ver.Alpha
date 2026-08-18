"use client";

import { useEffect, useState } from "react";
import { PulseShell } from "./PulseShell";

const endpoints: Record<string, string> = { activities: "/api/activities", departments: "/api/departments", roles: "/api/roles", persons: "/api/persons", users: "/api/users" };
const fields: Record<string, Array<[string, string]>> = {
  activities: [["subGoalId", "شناسه زیرهدف"], ["title", "عنوان"], ["description", "شرح"], ["ownerPersonId", "شناسه مسئول"]],
  departments: [["name", "نام واحد"], ["active", "فعال"]],
  roles: [["title", "عنوان سمت"], ["departmentId", "شناسه واحد"]],
  persons: [["fullName", "نام و نام خانوادگی"], ["seatId", "سمت / نقش"], ["active", "فعال"]],
  users: [["username", "نام کاربری"], ["password", "گذرواژه جدید"], ["roleId", "شناسه نقش"], ["departmentId", "شناسه واحد"], ["active", "فعال"]]
};

export function RecordDetailPage({ section, id }: { section: string; id: string }) {
  const endpoint = endpoints[section] ?? endpoints.departments;
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [roles, setRoles] = useState<Array<Record<string, unknown>>>([]);
  const [departments, setDepartments] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    fetch(`${endpoint}/${encodeURIComponent(id)}`).then((response) => response.json()).then((body) => {
      setRecord(body);
      setForm({ ...Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value ?? "")])), seatId: String(body.seatId ?? body.seat_id ?? "") });
    }).catch(() => setMessage("اطلاعات دریافت نشد."));
    if (section === "persons") {
      Promise.all([fetch("/api/roles").then((response) => response.json()), fetch("/api/departments").then((response) => response.json())]).then(([roleBody, departmentBody]) => {
        setRoles(Array.isArray(roleBody) ? roleBody : []);
        setDepartments(Array.isArray(departmentBody) ? departmentBody : []);
      }).catch(() => undefined);
    }
  }, [endpoint, id, section]);
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
  const selectedRole = roles.find((role) => String(role.id) === form.seatId);
  const selectedDepartment = departments.find((department) => String(department.id) === String(selectedRole?.department_id));
  return <PulseShell><div className="page"><div className="page-heading"><div><div className="eyebrow">جزئیات و ویرایش</div><h1>{section} — {id}</h1></div></div>{!record ? <div className="empty">در حال دریافت اطلاعات...</div> : <div className="panel"><form onSubmit={save}><div className="form-grid">{(fields[section] ?? []).map(([key, label]) => <label key={key}>{label}{section === "persons" && key === "seatId" ? <select value={form[key] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}><option value="">انتخاب سمت / نقش</option>{roles.map((role) => <option key={String(role.id)} value={String(role.id)}>{String(role.title)} · {String(role.id)}</option>)}</select> : <input type={key === "password" ? "password" : "text"} value={form[key] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />}</label>)}</div>{section === "persons" && selectedRole && <div className="field-hint">واحد مرتبط: {String(selectedDepartment?.name ?? "واحد تعیین نشده")} · نقش: {String(selectedRole.title)}</div>}{message && <div className="form-error">{message}</div>}<div className="form-actions"><button className="primary-button">ذخیره تغییرات</button></div></form></div>}</div></PulseShell>;
}
