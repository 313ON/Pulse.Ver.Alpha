import Link from "next/link";
import { PulseShell } from "./PulseShell";

export function ImportPage() {
  return <PulseShell><div className="page import-page">
    <div className="page-heading"><div><div className="eyebrow">ورودی داده‌ها</div><h1>ورود اطلاعات</h1><p>مسیرهای ورود داده و آماده‌سازی فایل‌های سازمانی</p></div></div>
    <section className="panel import-entry-card">
      <div><span className="program-panel-kicker">Excel / Spreadsheet</span><h2>وارد کردن Excel</h2><p>هسته خواندن، نرمال‌سازی، نگاشت معنایی و بازبینی فایل Excel در لایه برنامه موجود است.</p><span className="status-pill yellow">رابط کاربری بارگذاری در حال تکمیل</span></div>
      <div className="import-entry-actions"><Link href="/reports" className="secondary-button">مشاهده گزارش داده‌ها</Link><Link href="/settings" className="primary-button">تنظیمات ورود اطلاعات</Link></div>
    </section>
    <section className="panel import-status-panel"><div className="panel-head"><h2>وضعیت قابلیت</h2><span>شفافیت عملیاتی</span></div><div className="import-status-list"><div><strong>خواندن workbook</strong><span className="status-pill green">موجود</span></div><div><strong>نرمال‌سازی و نگاشت معنایی</strong><span className="status-pill green">موجود</span></div><div><strong>صف بازبینی و ثبت از UI</strong><span className="status-pill gray">رابط کاربری موجود نیست</span></div></div></section>
  </div></PulseShell>;
}
