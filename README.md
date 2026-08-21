# PULSE

PULSE سامانه‌ی فارسی و راست‌به‌چپ برنامه‌ریزی، اجرا و پایش عملکرد شرکت چرب شیمی است.

## اجرای محلی

```bash
npm install
npm run dev
```

برای استقرار روی HTTPS، مقدار زیر را تنظیم کنید:

```bash
PULSE_HTTPS=true
```

برای استقرار داخلی روی HTTP، `PULSE_HTTPS` را تنظیم نکنید یا مقدار `false` قرار دهید. حفاظت CSRF در هر دو حالت فعال می‌ماند؛ این متغیر فقط مشخص می‌کند کوکی‌های نشست و CSRF با ویژگی `Secure` ارسال شوند یا نه.

بررسی کیفیت:

```bash
npm run typecheck
npm run build
```

رابط فعلی شامل داشبورد مدیریتی، پیشرفت G01 تا G10، وضعیت واحدها، اقدامات نیازمند توجه، سلامت KPI، drill-down هدف و فرم ثبت اقدام است. سال برنامه و تاریخ‌های آن از `PlanningContext` خوانده می‌شوند و با متغیرهای `PULSE_PLAN_YEAR`، `PULSE_PLAN_START_DATE`، `PULSE_PLAN_END_DATE` و `PULSE_PLAN_TODAY` قابل تنظیم هستند. Migration رابطه‌ای پایه در `db/migrations/0001_pulse.sql` نگهداری می‌شود.
