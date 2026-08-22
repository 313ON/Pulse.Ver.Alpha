# PULSE — راهنمای استقرار production

این راهنما برای استقرار نسخه‌ی production سامانه‌ی PULSE با Next.js و SQLite است. دامنه‌ی آن فقط اجرای موجود، تنظیمات محیطی و کنترل‌های عملیاتی است.

## پیش‌نیازها

- Node.js 22 LTS؛ نسخه‌ی پشتیبانی‌شده در `package.json` با `engines` اعلام شده است
- فضای دیسک پایدار برای فایل SQLite و فایل‌های journal آن
- دسترسی نوشتن کاربر runtime به پوشه‌ی `PULSE_DB_PATH`
- نگهداری secretها خارج از مخزن
- reverse proxy یا load balancer در صورت ارائه‌ی HTTPS

## تنظیمات محیطی

پیش از اولین راه‌اندازی این مقدار را تنظیم کنید:

```text
PULSE_ADMIN_PASSWORD=<secret-at-least-8-characters>
```

مقدار الزامی production و مقادیر اختیاری:

```text
PULSE_DB_PATH=/var/lib/pulse/pulse.sqlite
PULSE_HTTPS=true
PULSE_PLAN_YEAR=1405
PULSE_PLAN_START_DATE=1405/01/01
PULSE_PLAN_END_DATE=1405/12/29
PULSE_PLAN_TODAY=1405/06/15
```

`PULSE_DB_PATH` در production الزامی است و باید به یک فایل SQLite روی
storage پایدار، خارج از مسیر مخزن و build، اشاره کند. برنامه در production
در صورت نبودن این مقدار با خطا متوقف می‌شود و به `db/pulse.sqlite` برنمی‌گردد.

`PULSE_PLAN_TODAY` باید برای اجرای production به‌صورت آگاهانه تنظیم شود؛ مقدار پیش‌فرض برای محیط آزمایشی است و جایگزین فرایند تقویمی سازمان نیست.

در production مقدار `PULSE_HTTPS=true` را فقط زمانی تنظیم کنید که ترافیک کاربر
پیش از رسیدن به Next.js در یک reverse proxy یا load balancer با TLS خاتمه یابد.
این متغیر HTTPS ایجاد نمی‌کند؛ فقط ویژگی `Secure` را برای کوکی‌های نشست و CSRF
فعال می‌کند.

## ساخت و راه‌اندازی

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm start
```

برای تعیین پورت، آرگومان Next.js را به start بدهید:

```bash
npm start -- -p 3000
```

فایل SQLite را داخل image یا release package قرار ندهید. مسیر آن باید روی storage پایدار و خارج از مسیر build باشد. هم‌زمان فقط یک instance نویسنده برای هر فایل SQLite اجرا کنید، مگر اینکه معماری deployment به‌طور جداگانه برای این محدودیت طراحی و تأیید شده باشد.

## کنترل پس از استقرار

1. `GET /api/health` را بررسی کنید؛ انتظار `200` و JSON با `status: "ok"` و `database: "ok"` است.
2. صفحه‌ی `/login` را بررسی کنید.
3. با حساب عملیاتی، ورود و `GET /api/auth/me` را بررسی کنید.
4. یک مسیر خواندنی مجاز مانند `/api/dashboard` را بررسی کنید.
5. لاگ‌های runtime را برای خطای SQLite، permission یا migration بررسی کنید.

اگر health check پاسخ `503` داد، ترافیک را به instance وارد نکنید و ابتدا وجود فایل، integrity، کامل بودن schema، دسترسی پوشه و مقدار `PULSE_DB_PATH` را بررسی کنید.

پاسخ health با `Cache-Control: no-store` ارائه می‌شود و نباید در reverse proxy
یا load balancer cache شود.

## انتشار نسخه‌ی جدید

نسخه‌ی جدید را در یک release directory جداگانه build کنید، validationها را اجرا کنید، سپس process را با روش مدیریت سرویس محیط متوقف و با artifact جدید راه‌اندازی کنید. فایل database را جابه‌جا یا overwrite نکنید. قبل از هر release از آن backup بگیرید.

فرایند backup و rollback در `docs/operations/RUNBOOK.md` آمده است.
