"use client";

import { usePathname } from "next/navigation";

const sectionNames: Record<string, string> = {
  "/": "مرکز فرمان",
  "/goals": "اهداف سازمانی",
  "/departments": "واحدهای عملیاتی",
  "/roles": "سمت‌ها و نقش‌ها",
  "/persons": "پرسنل",
  "/users": "کاربران",
  "/actions": "اقدامات",
  "/activities": "فعالیت‌ها",
  "/kpis": "شاخص‌های کلیدی",
  "/risks": "ریسک‌ها",
  "/dependencies": "وابستگی‌ها",
  "/reports": "گزارش‌ها",
  "/settings": "تنظیمات"
};

export function CommandHeader() {
  const pathname = usePathname();
  const section = sectionNames[pathname] ?? "نمای عملیاتی";

  return (
    <header className="topbar command-header">
      <div className="command-context">
        <span className="command-kicker">PULSE / COMMAND</span>
        <span className="command-divider">/</span>
        <strong>{section}</strong>
      </div>
      <div className="top-actions">
        <label className="search command-search">
          <span>⌕</span>
          <input aria-label="جستجوی سراسری" placeholder="جستجوی سراسری..." />
          <kbd>⌘ K</kbd>
        </label>
        <button className="icon-button command-alert" aria-label="اعلان‌ها">♧<i /></button>
        <div className="date-chip"><span>چرخه</span> ۱۴۰۵</div>
      </div>
    </header>
  );
}
