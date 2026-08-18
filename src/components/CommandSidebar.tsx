"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["مرکز راهبردی", "/", "✦"],
  ["نمای اجرایی", "/program", "⌂"],
  ["اهداف کلی", "/goals", "◎"],
  ["اهداف جزئی", "/sub-goals", "◇"],
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

export function CommandSidebar({
  user,
  onLogout
}: {
  user: { username: string; role: string } | null;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="sidebar command-sidebar">
      <div className="brand">
        <div className="brand-mark">P</div>
        <div><strong>PULSE</strong><span>برنامه دیجیتال سازمان</span><small>چرب شیمی</small></div>
      </div>
      <div className="workspace-label"><span className="status-dot green" /> سازمان / چرب شیمی</div>
      <div className="nav-caption">ناوبری فرمان</div>
      <nav aria-label="ناوبری اصلی">
        {items.map(([label, href, icon]) => (
          <Link key={href} href={href} className={`nav-item ${pathname === href ? "active" : ""}`}>
            <span className="nav-icon">{icon}</span><span>{label}</span><span className="nav-chevron">‹</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="support-card"><span className="support-dot" /> وضعیت سامانه<strong>آنلاین / پایش فعال</strong></div>
        <div className="user-card">
          <div className="avatar">{user?.username?.slice(0, 1) ?? "م"}</div>
          <div><strong>{user?.username ?? "کاربر مهمان"}</strong><span>{user?.role ?? "ورود لازم است"}</span></div>
          <button className="logout-button" onClick={onLogout}>خروج</button>
        </div>
      </div>
    </aside>
  );
}
