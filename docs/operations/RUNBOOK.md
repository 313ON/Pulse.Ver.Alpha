# PULSE Release 1 — راهنمای عملیات و بازیابی

## بررسی سریع سرویس Windows

```powershell
Get-Service -Name "<SERVICE_NAME>"
Get-Process -Name node
Get-NetTCPConnection -LocalPort <PORT> -State Listen
Invoke-WebRequest "http://127.0.0.1:<PORT>/api/health" -UseBasicParsing
```

فقط process متعلق به release جاری و یک writer برای فایل SQLite باید فعال باشد.
secretها را در خروجی یا log چاپ نکنید.

## بررسی سلامت

`GET /api/health` باید HTTP 200 با `status: "ok"` و `database: "ok"` بدهد.
کد 503 یعنی فایل وجود ندارد، قابل خواندن نیست، integrity ناموفق است، schema
ناقص است یا اتصال runtime برقرار نشده است.

## Backup

Backup باید با SQLite online backup انجام شود؛ WAL فعال است و raw copy فایل
اصلی approved نیست.

```powershell
sqlite3.exe "<PULSE_DB_PATH>" ".backup '<BACKUP_DIR>\pulse-<yyyyMMdd-HHmmss>.sqlite'"
sqlite3.exe "<BACKUP_DIR>\pulse-<timestamp>.sqlite" "PRAGMA integrity_check;"
sqlite3.exe "<BACKUP_DIR>\pulse-<timestamp>.sqlite" "PRAGMA foreign_key_check;"
Get-FileHash -Algorithm SHA256 -LiteralPath "<BACKUP_DIR>\pulse-<timestamp>.sqlite"
```

ترتیب ثبت evidence:

```text
BACKUP → integrity_check → foreign_key_check → schema readiness → checksum
```

## Restore

1. سرویس را متوقف و از ترافیک خارج کنید.
2. database فعلی را در مسیر قرنطینه نگه دارید.
3. backup انتخابی را با integrity و foreign-key check تأیید کنید.
4. backup را به مسیر دقیق `PULSE_DB_PATH` restore کنید و ACL حساب سرویس را
   اعمال کنید.
5. سرویس را راه‌اندازی کنید.
6. health، login، یک مسیر خواندنی، reporting و restart persistence را بررسی
   کنید.
7. زمان restore، نام backup، checksum و دامنه داده ازدست‌رفته را ثبت کنید.

فایل‌های `-wal` و `-shm` را جداگانه کپی نکنید. هر restore ممکن است داده‌های پس
از زمان backup را از بین ببرد.

## Restart و rollback

- restart فقط از طریق process manager انجام شود.
- rollback برنامه یعنی artifact قبلی؛ database را به عقب برنگردانید مگر با
  restore رسمی و compatibility اثبات‌شده.
- بعد از restart یا rollback، health، login، read، report و persistence را
  تکرار کنید.

## کنترل‌های امنیتی

- `PULSE_ADMIN_PASSWORD` در مخزن، command history یا log نباشد.
- `PULSE_DB_PATH` absolute و خارج از release directory باشد.
- database و backupها public یا در web root نباشند.
- حساب سرویس administrator نباشد.
- فقط یک writer برای هر database فعال باشد.
- در HTTPS مقدار `PULSE_HTTPS=true` فقط با TLS termination تأییدشده تنظیم شود.
