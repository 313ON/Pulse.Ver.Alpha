# PULSE

PULSE سامانه‌ی فارسی و راست‌به‌چپ برنامه‌ریزی، اجرا و پایش عملکرد شرکت چرب شیمی است.

## الزامات اجرا

- Node.js 22 یا نسخه‌ی سازگار با `package.json`
- دسترسی نوشتن فرآیند به مسیر پایگاه‌داده‌ی SQLite
- مقداردهی `PULSE_ADMIN_PASSWORD` برای ایجاد مدیر اولیه
- اجرای build روی همان محیطی که `npm start` اجرا می‌شود

## اجرای محلی

```bash
npm install
npm run dev
```

## قرارداد محیطی

| متغیر | الزامی | مقدار پیش‌فرض | کاربرد |
|---|---:|---|---|
| `PULSE_ADMIN_PASSWORD` | بله، در اولین راه‌اندازی | ندارد | گذرواژه‌ی مدیر اولیه؛ حداقل ۸ نویسه |
| `PULSE_DB_PATH` | خیر | `db/pulse.sqlite` | مسیر فایل SQLite |
| `PULSE_HTTPS` | خیر | `false` | فعال‌سازی ویژگی `Secure` برای کوکی‌های نشست و CSRF |
| `PULSE_PLAN_YEAR` | خیر | `1405` | سال چرخه‌ی برنامه |
| `PULSE_PLAN_START_DATE` | خیر | `${PULSE_PLAN_YEAR}/01/01` | شروع چرخه |
| `PULSE_PLAN_END_DATE` | خیر | `${PULSE_PLAN_YEAR}/12/29` | پایان چرخه |
| `PULSE_PLAN_TODAY` | خیر | `${PULSE_PLAN_YEAR}/06/15` | تاریخ مرجع محاسبات عملیاتی |

مقادیر محیطی را خارج از مخزن و با دسترسی محدود نگهداری کنید. پس از ایجاد مدیر اولیه، مقدار `PULSE_ADMIN_PASSWORD` همچنان باید در محیط امن deployment نگهداری شود؛ برنامه آن را در پایگاه‌داده ذخیره نمی‌کند.

برای استقرار روی HTTPS، مقدار زیر را تنظیم کنید:

```bash
PULSE_HTTPS=true
```

برای استقرار داخلی روی HTTP، `PULSE_HTTPS` را تنظیم نکنید یا مقدار `false` قرار دهید. حفاظت CSRF در هر دو حالت فعال می‌ماند؛ این متغیر فقط مشخص می‌کند کوکی‌های نشست و CSRF با ویژگی `Secure` ارسال شوند یا نه. راهنمای کامل در `docs/operations/DEPLOYMENT.md` و `docs/operations/RUNBOOK.md` قرار دارد.

## بررسی کیفیت

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

پس از اجرای production server با `npm start`، endpoint بررسی سلامت `GET /api/health` در دسترس است. پاسخ `200` با وضعیت `ok` نشان می‌دهد فرآیند و فایل SQLite قابل خواندن هستند؛ پاسخ `503` به معنی آماده نبودن پایگاه‌داده یا عدم دسترسی runtime به آن است.

رابط فعلی شامل داشبورد مدیریتی، پیشرفت G01 تا G10، وضعیت واحدها، اقدامات نیازمند توجه، سلامت KPI، drill-down هدف و فرم ثبت اقدام است. سال برنامه و تاریخ‌های آن از `PlanningContext` خوانده می‌شوند و با متغیرهای `PULSE_PLAN_YEAR`، `PULSE_PLAN_START_DATE`، `PULSE_PLAN_END_DATE` و `PULSE_PLAN_TODAY` قابل تنظیم هستند. Migration رابطه‌ای پایه در `db/migrations/0001_pulse.sql` نگهداری می‌شود.
