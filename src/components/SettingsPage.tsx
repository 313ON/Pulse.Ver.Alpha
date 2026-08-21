"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PulseShell } from "./PulseShell";

type ThemeMode = "dark" | "light" | "system";

export function SettingsPage() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem("pulse-theme") as ThemeMode | null;
    if (stored === "dark" || stored === "light" || stored === "system") setMode(stored);
  }, []);

  function changeMode(next: ThemeMode) {
    setMode(next);
    if (next === "system") {
      document.documentElement.removeAttribute("data-theme");
      window.localStorage.removeItem("pulse-theme");
    } else {
      document.documentElement.dataset.theme = next;
      window.localStorage.setItem("pulse-theme", next);
    }
  }

  return <PulseShell><div className="page settings-page">
    <div className="page-heading"><div><div className="eyebrow">تنظیمات / ترجیحات برنامه</div><h1>تنظیمات سامانه</h1><p>ظاهر و ترجیحات شخصی Pulse را مدیریت کنید.</p></div></div>
    <section className="panel settings-section"><div className="panel-head"><div><span className="program-panel-kicker">Appearance</span><h2>ظاهر</h2></div></div><div className="theme-options" role="radiogroup" aria-label="حالت نمایش">{(["dark", "light", "system"] as ThemeMode[]).map((item) => <button key={item} className={`theme-option ${mode === item ? "selected" : ""}`} onClick={() => changeMode(item)} aria-pressed={mode === item}><strong>{item === "dark" ? "تیره" : item === "light" ? "روشن" : "سیستم"}</strong><span>{item === "dark" ? "نمایش سازمانی تیره" : item === "light" ? "نمایش روشن و خوانا" : "هماهنگ با تنظیمات دستگاه"}</span></button>)}</div></section>
    <section className="settings-grid"><div className="panel settings-section"><span className="program-panel-kicker">Application preferences</span><h2>ترجیحات برنامه</h2><p>تنظیمات زبان، چرخه برنامه و تراکم نمایش در نسخه بعدی قابل تنظیم خواهد بود.</p></div><div className="panel settings-section"><span className="program-panel-kicker">Future configuration</span><h2>پیکربندی‌های آینده</h2><p>اتصال‌های حاکمیت، اعلان‌ها و سطح دسترسی ماژول‌ها در این بخش توسعه می‌یابد.</p></div><div className="panel settings-section settings-user-management"><span className="program-panel-kicker">Access administration</span><h2>مدیریت کاربران</h2><p>مشاهده، افزودن و ویرایش کاربران و نقش‌های دسترسی سامانه.</p><Link href="/users" className="primary-button">باز کردن مدیریت کاربران</Link><small>حذف کاربر در API فعلی پشتیبانی نمی‌شود.</small></div><div className="panel settings-section"><span className="program-panel-kicker">ورودی داده‌ها</span><h2>ورود اطلاعات</h2><p>برای مشاهده وضعیت زیرساخت ورود Excel و داده‌های جدولی به بخش ورودی داده‌ها بروید.</p><Link href="/imports" className="secondary-button">مشاهده ورودی داده‌ها</Link></div></section>
  </div></PulseShell>;
}
