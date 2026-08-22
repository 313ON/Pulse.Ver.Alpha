# PULSE — راهنمای استقرار Release 1 روی Windows Server

این راهنما برای استقرار PULSE Release 1 با Next.js و SQLite است. مسیر واقعی
سرور، حساب سرویس، پورت و service manager باید در change record ثبت شوند؛
مقادیر داخل `<...>` فقط جای‌نگهدار هستند.

## پیش‌نیازها

- Node.js 22 LTS
- فضای دیسک پایدار برای SQLite و فایل‌های WAL
- دسترسی Administrator برای تنظیم سرویس، ACL و firewall
- service manager تأییدشده‌ی سازمان؛ NSSM گزینه‌ی کوچک پیشنهادی است
- نگهداری secretها خارج از مخزن
- اجرای فقط یک process نویسنده برای هر فایل SQLite

## متغیرهای محیطی

برای اولین راه‌اندازی:

```text
NODE_ENV=production
PULSE_DB_PATH=<absolute external Windows path>\pulse.sqlite
PULSE_ADMIN_PASSWORD=<secret-at-least-8-characters>
PULSE_SEED_MODE=reference
PULSE_RELEASE_COMMIT=<deployed git commit>
PULSE_PLAN_YEAR=1405
PULSE_PLAN_START_DATE=1405/01/01
PULSE_PLAN_END_DATE=1405/12/29
PULSE_PLAN_TODAY=<approved operational reference date>
PULSE_HTTPS=<true only when TLS terminates before Next.js>
```

`PULSE_DB_PATH` باید absolute، persistent، ACL-protected و خارج از
`RELEASE_DIR` باشد. `PULSE_SEED_MODE=reference` داده‌های نمایشی هدف، اقدام،
KPI، ریسک و وابستگی را ایجاد نمی‌کند. `PULSE_ADMIN_PASSWORD` فقط برای ساخت
مدیر اولیه است؛ پس از اولین provisioning آن را از environment سرویس حذف کنید.
گذرواژه را در source، Git، command history یا log قرار ندهید.

`PULSE_HTTPS=true` فقط وقتی مجاز است که TLS پیش از Next.js در reverse proxy
خاتمه یابد؛ این متغیر به‌تنهایی HTTPS ایجاد نمی‌کند.

## ساخت artifact

```powershell
Set-Location "<RELEASE_DIR>"
npm ci
npm test
npm run typecheck
npm run lint
npm run build
git rev-parse HEAD
```

## مدل سرویس

Repository evidence فعلی دسترسی به Windows Server و وجود NSSM را اثبات نمی‌کند.
مدیر سرور باید service manager approved سازمان را قبل از اجرا ثبت کند. IIS
برای اجرای برنامه لازم نیست.

```text
<RELEASE_DIR>                 release/application files (read/execute)
<DATA_ROOT>\db                external persistent SQLite database
<DATA_ROOT>\Backups           verified backups
<DATA_ROOT>\Logs              service logs
```

نمونه‌ی تنظیم NSSM پس از نصب approved آن:

```powershell
nssm install <SERVICE_NAME> "C:\Program Files\nodejs\node.exe" "node_modules\next\dist\bin\next start -p <PORT>"
nssm set <SERVICE_NAME> AppDirectory "<RELEASE_DIR>"
nssm set <SERVICE_NAME> AppEnvironmentExtra "NODE_ENV=production" "PULSE_DB_PATH=<DB_DIR>\pulse.sqlite" "PULSE_SEED_MODE=reference" "PULSE_PLAN_YEAR=1405" "PULSE_PLAN_TODAY=<approved-date>" "PULSE_RELEASE_COMMIT=<commit>"
nssm set <SERVICE_NAME> AppExit Default Restart
nssm set <SERVICE_NAME> AppStdout "<LOG_DIR>\pulse.stdout.log"
nssm set <SERVICE_NAME> AppStderr "<LOG_DIR>\pulse.stderr.log"
nssm start <SERVICE_NAME>
```

مقدارهای داخل `<...>` را از سازمان دریافت و در change record ثبت کنید. اگر
NSSM نصب یا approved نیست، از service manager موجود و approved استفاده کنید؛
برنامه را با session تعاملی توسعه‌دهنده به‌عنوان production اجرا نکنید.

حساب سرویس روی release directory فقط read/execute و روی database directory
read/write داشته باشد. دسترسی backup operator به Backups جدا و محدود باشد.

## SQLite baseline

runtime برای هر connection این تنظیمات را اعمال می‌کند:

```text
journal_mode=WAL
synchronous=FULL
foreign_keys=ON
busy_timeout=5000
wal_autocheckpoint=1000
locking_mode=NORMAL
temp_store=DEFAULT
```

فایل SQLite را داخل release یا build قرار ندهید و آن را raw-copy نکنید. برای
backup از SQLite online backup استفاده کنید.

## کنترل پس از استقرار

```powershell
Get-Service -Name "<SERVICE_NAME>"
Get-NetTCPConnection -LocalPort <PORT> -State Listen
Invoke-WebRequest "http://127.0.0.1:<PORT>/api/health" -UseBasicParsing
```

انتظار: HTTP 200 و JSON شامل `status: "ok"` و `database: "ok"`. سپس `/login`,
`/api/auth/me`, یک مسیر خواندنی و کل
`docs/operations/RELEASE-1-SMOKE-TEST.md` را اجرا کنید.

اگر health پاسخ 503 داد، ترافیک را وارد نکنید و path، ACL، integrity، schema،
فضای دیسک و processهای writer را بررسی کنید.

## انتشار و rollback

هر نسخه را در release directory جدا build کنید و قبل از فعال‌سازی backup
بگیرید. در خطای application، artifact قبلی را برگردانید و database را
downgrade نکنید مگر compatibility آن اثبات شده باشد. برای corruption یا
import اشتباه، طبق RUNBOOK سرویس را متوقف، database فعلی را قرنطینه، backup
verified را restore و health/login/read/report/restart را تکرار کنید.
