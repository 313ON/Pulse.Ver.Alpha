"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const items = [
  ["داشبورد", "/", "⌂"],
  ["اهداف", "/goals", "◎"],
  ["واحدها", "/departments", "▦"],
  ["سمت‌ها و نقش‌ها", "/roles", "◈"],
  ["پرسنل", "/persons", "●"],
  ["کاربران", "/users", "◉"],
  ["اقدامات", "/actions", "✓"],
  ["فعالیت‌ها", "/activities", "◌"],
  ["شاخص‌ها", "/kpis", "◆"],
  ["ریسک‌ها", "/risks", "△"],
  ["وابستگی‌ها", "/dependencies", "↔"],
  ["گزارش‌ها", "/reports", "▤"],
  ["تنظیمات", "/settings", "⚙"]
] as const;

export function PulseShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  useEffect(() => {
    fetch("/api/auth/me").then((response) => response.json()).then((body) => {
      if (!body.user) router.replace("/login");
      else setUser(body.user);
    }).catch(() => router.replace("/login"));
  }, []);
  async function logout() {
    const csrf = await fetch("/api/auth/csrf").then((response) => response.json());
    await fetch("/api/auth/logout", { method: "POST", headers: { "x-csrf-token": csrf.token } });
    router.push("/login");
    router.refresh();
  }
  return (
    <main className="app-shell pulse-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div><strong>PULSE</strong><span>برنامه‌ریزی و کنترل عملکرد</span></div>
        </div>
        <div className="workspace-label">شرکت چرب شیمی</div>
        <nav aria-label="ناوبری اصلی">
          {items.map(([label, href, icon]) => (
            <Link key={href} href={href} className={`nav-item ${pathname === href ? "active" : ""}`}>
              <span className="nav-icon">{icon}</span><span>{label}</span><span className="nav-chevron">‹</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-card"><span className="support-dot" /> وضعیت سامانه<strong>فعال و آماده</strong></div>
          <div className="user-card"><div className="avatar">{user?.username?.slice(0, 1) ?? "م"}</div><div><strong>{user?.username ?? "کاربر مهمان"}</strong><span>{user?.role ?? "ورود لازم است"}</span></div><button className="logout-button" onClick={logout}>خروج</button></div>
        </div>
      </aside>
      <section className="content">
        <header className="topbar">
          <div className="breadcrumbs">PULSE <span>‹</span> {items.find((item) => item[1] === pathname)?.[0] ?? "صفحه"}</div>
          <div className="top-actions">
            <label className="search"><span>⌕</span><input aria-label="جستجوی سراسری" placeholder="جستجو در PULSE..." /></label>
            <button className="icon-button" aria-label="اعلان‌ها">♧<i /></button>
            <div className="date-chip">سال برنامه: ۱۴۰۵</div>
          </div>
        </header>
        {children}
        <footer className="app-footer" aria-label="PULSE footer">
          <span>Made with love, coffee &amp; code by 313ON</span>
          <span>Charb Chimie • Pulse Platform • 2026</span>
        </footer>
      </section>
    </main>
  );
}
