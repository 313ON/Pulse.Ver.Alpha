"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const csrf = await fetch("/api/auth/csrf").then((response) => response.json());
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token }, body: JSON.stringify({ username, password }) });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { setError(body.error ?? "ورود انجام نشد."); return; }
    router.push("/");
    router.refresh();
  }
  return <main className="login-page" dir="rtl"><section className="login-card"><div className="brand-mark">P</div><h1>ورود به PULSE</h1><p>سامانه برنامه‌ریزی و کنترل عملکرد چرب شیمی</p><form onSubmit={submit}><label>نام کاربری<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label><label>گذرواژه<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button" disabled={busy}>{busy ? "در حال ورود..." : "ورود"}</button></form><small>احراز هویت از طریق نشست امن سمت سرور انجام می‌شود.</small></section></main>;
}
