"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["مرکز راهبردی", "/", "✦"],
  ["نمای اجرایی", "/program", "⌂"],
  ["اهداف کلی", "/goals", "◎"],
  ["اهداف جزئی", "/sub-goals", "◇"],
  ["فعالیت‌ها", "/activities", "◌"],
  ["اقدام‌ها", "/actions", "✓"],
  ["واحدها", "/departments", "▦"],
  ["سمت‌ها و نقش‌ها", "/roles", "◈"],
  ["پرسنل", "/persons", "●"],
  ["شاخص‌ها", "/kpis", "◆"],
  ["ریسک‌ها", "/risks", "△"],
  ["وابستگی‌ها", "/dependencies", "↔"],
  ["ورودی داده‌ها", "/imports", "⇩"],
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen]);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        ref={toggleRef}
        className="mobile-nav-toggle"
        type="button"
        aria-expanded={isMobileOpen}
        aria-controls="pulse-command-sidebar"
        aria-label={isMobileOpen ? "بستن منوی اصلی" : "باز کردن منوی اصلی"}
        onClick={() => setIsMobileOpen((current) => !current)}
      >
        <span aria-hidden="true">☰</span>
      </button>
      {isMobileOpen && (
        <button
          className="mobile-nav-backdrop"
          type="button"
          aria-label="بستن منوی اصلی"
          onClick={() => {
            setIsMobileOpen(false);
            toggleRef.current?.focus();
          }}
        />
      )}
    <aside id="pulse-command-sidebar" className={`sidebar command-sidebar${isMobileOpen ? " is-mobile-open" : ""}`} aria-label="منوی اصلی">
      <div className="brand">
        <div className="brand-mark">P</div>
        <div><strong>PULSE</strong><span>برنامه دیجیتال سازمان</span><small>چرب شیمی</small></div>
      </div>
      <div className="workspace-label"><span className="status-dot green" /> سازمان / چرب شیمی</div>
      <div className="nav-caption">ناوبری فرمان</div>
      <nav aria-label="ناوبری اصلی">
        {items.map(([label, href, icon]) => (
          <Link key={href} href={href} className={`nav-item ${pathname === href ? "active" : ""}`} onClick={() => setIsMobileOpen(false)}>
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
    </>
  );
}
