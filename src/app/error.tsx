"use client";

export default function Error({ reset }: { reset: () => void }) {
  return <main className="page strategic-command-center"><section className="panel program-empty-state" role="alert"><span className="program-panel-kicker">خطای داده زنده</span><h2>بارگذاری برنامه انجام نشد</h2><p>اتصال به داده‌های پایدار برنامه با خطا روبه‌رو شد.</p><button className="primary-button" onClick={reset}>تلاش دوباره</button></section></main>;
}
