"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PulseShell } from "./PulseShell";

type Row = Record<string, unknown>;
type SelectKey = "goals" | "subGoals" | "departments" | "roles" | "persons" | "activities";
type Field = { key: string; label: string; select?: SelectKey; required?: boolean; readOnly?: boolean };

const config: Record<string, { title: string; endpoint: string; columns: Array<[string, string]> }> = {
  goals: { title: "اهداف کلی", endpoint: "/api/goals", columns: [["id", "شناسه"], ["title", "عنوان"]] },
  "sub-goals": { title: "اهداف جزئی", endpoint: "/api/sub-goals", columns: [["id", "شناسه"], ["goal_id", "هدف کلی"], ["title", "عنوان"]] },
  activities: { title: "فعالیت‌ها", endpoint: "/api/activities", columns: [["id", "شناسه"], ["sub_goal_id", "هدف جزئی"], ["title", "عنوان"], ["owner", "مسئول"], ["activity_action_count", "اقدامات مرتبط"]] },
  departments: { title: "واحدها", endpoint: "/api/departments", columns: [["id", "شناسه"], ["name", "نام واحد"], ["active", "وضعیت"]] },
  roles: { title: "سمت‌ها و نقش‌ها", endpoint: "/api/roles", columns: [["id", "شناسه"], ["title", "سمت / نقش"], ["department_id", "واحد"], ["assigned_people", "پرسنل تخصیص‌یافته"]] },
  persons: { title: "پرسنل", endpoint: "/api/persons", columns: [["id", "کد پرسنلی"], ["full_name", "نام"], ["department", "واحد"], ["position", "سمت"], ["role", "نقش"]] },
  users: { title: "کاربران سامانه", endpoint: "/api/users", columns: [["id", "شناسه"], ["username", "نام کاربری"], ["role", "نقش"], ["active", "وضعیت"]] },
  actions: { title: "اقدامات", endpoint: "/api/actions", columns: [["public_id", "شناسه اقدام"], ["title", "عنوان"], ["status", "وضعیت"], ["progress", "پیشرفت"], ["planned_end", "موعد"]] },
  kpis: { title: "شاخص‌ها", endpoint: "/api/kpis", columns: [["id", "شناسه"], ["name", "نام شاخص"], ["actual", "مقدار فعلی"], ["target", "هدف"]] },
  risks: { title: "ریسک‌ها", endpoint: "/api/risks", columns: [["id", "شناسه"], ["title", "عنوان"], ["severity", "شدت"], ["status", "وضعیت"]] },
  dependencies: { title: "وابستگی‌ها", endpoint: "/api/dependencies", columns: [["id", "شناسه"], ["source_work_item_id", "مبدأ"], ["target_work_item_id", "مقصد"], ["status", "وضعیت"]] },
  "monthly-reviews": { title: "بازبینی‌های ماهانه", endpoint: "/api/monthly-reviews", columns: [["id", "شناسه"], ["month_key", "ماه"], ["department_id", "واحد"], ["actual_summary", "عملکرد واقعی"], ["management_decision", "تصمیم مدیریت"]] }
};

const fieldsBySection: Record<string, Field[]> = {
  goals: [{ key: "id", label: "شناسه هدف", required: true }, { key: "title", label: "عنوان هدف کلی", required: true }],
  "sub-goals": [{ key: "id", label: "شناسه هدف جزئی", required: true }, { key: "goalId", label: "هدف کلی", select: "goals", required: true }, { key: "title", label: "عنوان هدف جزئی", required: true }],
  activities: [{ key: "id", label: "شناسه فعالیت" }, { key: "subGoalId", label: "هدف جزئی", select: "subGoals", required: true }, { key: "title", label: "عنوان فعالیت", required: true }, { key: "description", label: "شرح" }, { key: "ownerPersonId", label: "مسئول", select: "persons" }],
  departments: [{ key: "id", label: "شناسه واحد", required: true }, { key: "name", label: "نام واحد", required: true }],
  roles: [{ key: "id", label: "شناسه سمت / نقش", required: true }, { key: "title", label: "عنوان سمت / نقش", required: true }, { key: "departmentId", label: "واحد", select: "departments", required: true }],
  persons: [{ key: "id", label: "کد پرسنلی", required: true }, { key: "fullName", label: "نام و نام خانوادگی", required: true }, { key: "seatId", label: "سمت / نقش", select: "roles", required: true }],
  actions: [{ key: "goalId", label: "هدف کلی", select: "goals", required: true }, { key: "objectiveId", label: "هدف جزئی", select: "subGoals" }, { key: "activityId", label: "فعالیت", select: "activities" }, { key: "title", label: "عنوان اقدام", required: true }, { key: "departmentId", label: "واحد", select: "departments", required: true }, { key: "ownerPersonId", label: "مجری", select: "persons", required: true }, { key: "roleId", label: "سمت / نقش مسئول", select: "roles" }, { key: "workType", label: "نوع کار", required: true }, { key: "deliverable", label: "خروجی مورد انتظار", required: true }, { key: "deadline", label: "موعد پایان", required: true }],
  "monthly-reviews": [
    { key: "id", label: "شناسه بازبینی" },
    { key: "monthKey", label: "ماه (مثلاً 1405/06)", required: true },
    { key: "departmentId", label: "واحد", select: "departments", required: true },
    { key: "planSummary", label: "خلاصه برنامه" },
    { key: "actualSummary", label: "عملکرد واقعی" },
    { key: "deviation", label: "انحراف" },
    { key: "rootCause", label: "علت ریشه‌ای" },
    { key: "correctiveAction", label: "اقدام اصلاحی" },
    { key: "managementDecision", label: "تصمیم مدیریت" },
    { key: "nextMonthCommitment", label: "تعهد ماه بعد" }
  ]
};

export function ManagementPage({ section }: { section: string }) {
  const entry = config[section] ?? config.actions;
  const fields = fieldsBySection[section] ?? [];
  const [rows, setRows] = useState<Row[]>([]);
  const [catalogs, setCatalogs] = useState<Record<SelectKey, Row[]>>({ goals: [], subGoals: [], departments: [], roles: [], persons: [], activities: [] });
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    const requests: Array<[SelectKey, string]> = [
      ["goals", "/api/goals"], ["subGoals", "/api/sub-goals"], ["departments", "/api/departments"],
      ["roles", "/api/roles"], ["persons", "/api/persons"], ["activities", "/api/activities"]
    ];
    Promise.all([
      fetch(entry.endpoint).then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "خطا در دریافت اطلاعات");
        return Array.isArray(body) ? body : body.data ?? [];
      }),
      ...requests.map(([, endpoint]) => fetch(endpoint).then((response) => response.ok ? response.json() : []))
    ]).then(([records, ...catalogValues]) => {
      setRows(records as Row[]);
      const next = {} as Record<SelectKey, Row[]>;
      requests.forEach(([key], index) => { next[key] = (Array.isArray(catalogValues[index]) ? catalogValues[index] : []) as Row[]; });
      setCatalogs(next);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "خطا در دریافت اطلاعات"));
  }, [entry.endpoint]);

  const displayRows = useMemo(() => rows.map((row) => {
    if (section === "persons") {
      const seat = catalogs.roles.find((item) => String(item.id) === String(row.seat_id));
      const department = catalogs.departments.find((item) => String(item.id) === String(seat?.department_id));
      return { ...row, department: department?.name ?? "—", position: seat?.title ?? "—", role: seat?.title ?? "—" };
    }
    if (section === "roles") {
      const assigned = catalogs.persons.filter((person) => String(person.seat_id) === String(row.id)).map((person) => String(person.full_name ?? person.id));
      const department = catalogs.departments.find((item) => String(item.id) === String(row.department_id));
      return { ...row, department_id: department?.name ?? row.department_id, assigned_people: assigned.length > 0 ? assigned.join("، ") : "بدون تخصیص" };
    }
    if (section === "sub-goals") {
      const goal = catalogs.goals.find((item) => String(item.id) === String(row.goal_id));
      return { ...row, goal_id: goal ? `${goal.id} · ${goal.title}` : row.goal_id };
    }
    if (section === "activities") {
      const objective = catalogs.subGoals.find((item) => String(item.id) === String(row.sub_goal_id));
      return { ...row, sub_goal_id: objective ? `${objective.id} · ${objective.title}` : row.sub_goal_id };
    }
    return row;
  }), [catalogs, rows, section]);

  const filtered = useMemo(() => displayRows.filter((row) => JSON.stringify(row).toLocaleLowerCase("fa").includes(query.toLocaleLowerCase("fa"))), [displayRows, query]);

  async function createRecord(event: React.FormEvent) {
    event.preventDefault();
    const csrf = await fetch("/api/auth/csrf").then((response) => response.json());
    const payload = { ...form };
    if (section === "persons") delete payload.departmentId;
    const response = await fetch(entry.endpoint, { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "ثبت اطلاعات انجام نشد."); return; }
    setRows((current) => [...current, body]); setForm({}); setShowCreate(false); setError("");
  }

  return <PulseShell><div className="page">
    <div className="page-heading"><div><div className="eyebrow">مدیریت دانش سازمان و اجرای برنامه</div><h1>{entry.title}</h1><p>واژگان کنترل‌شده، ارتباطات سازمانی و داده‌های ثبت‌شده سامانه</p></div>{fields.length > 0 && <button className="primary-button" onClick={() => setShowCreate(true)}>＋ ثبت مورد جدید</button>}</div>
    {showCreate && <div className="panel create-panel"><form onSubmit={createRecord}><div className="form-grid">{fields.map((field) => <FieldInput key={field.key} field={field} value={form[field.key] ?? ""} options={field.select ? catalogs[field.select] : []} onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))} />)}</div><div className="form-actions"><button className="primary-button" type="submit">ذخیره</button><button className="secondary-button" type="button" onClick={() => setShowCreate(false)}>انصراف</button></div></form></div>}
    <div className="panel full-panel"><div className="panel-head"><h2>{entry.title}</h2><label className="inline-search">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجو در داده‌ها..." /></label></div>
      {error ? <div className="empty">{error}</div> : <div className="table-wrap"><table><caption className="sr-only">جدول {entry.title}</caption><thead><tr>{entry.columns.map(([, label]) => <th scope="col" key={label}>{label}</th>)}<th scope="col">عملیات</th></tr></thead><tbody>{filtered.map((row, index) => { const id = String(row.id ?? row.public_id ?? index); return <tr key={id}>{entry.columns.map(([key]) => <td key={key}>{key === "active" ? (row[key] ? "فعال" : "غیرفعال") : String(row[key] ?? "—")}</td>)}<td><Link className="table-action" href={`/${section}/${encodeURIComponent(id)}`}>مشاهده جزئیات</Link></td></tr>; })}</tbody></table>{filtered.length === 0 && <div className="empty">موردی برای نمایش وجود ندارد.</div>}</div>}
    </div>
  </div></PulseShell>;
}

function FieldInput({ field, value, options, onChange }: { field: Field; value: string; options: Row[]; onChange: (value: string) => void }) {
  if (!field.select) return <label>{field.label}<input required={field.required} readOnly={field.readOnly} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
  return <label>{field.label}<select required={field.required} value={value} onChange={(event) => onChange(event.target.value)}><option value="">انتخاب کنید</option>{options.map((option) => <option key={String(option.id)} value={String(option.id)}>{String(option.title ?? option.name ?? option.full_name ?? option.id)}{option.id ? ` · ${option.id}` : ""}</option>)}</select></label>;
}
