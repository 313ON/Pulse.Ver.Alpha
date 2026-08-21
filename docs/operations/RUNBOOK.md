# PULSE — راهنمای عملیات و بازیابی

## بررسی سلامت

```bash
curl -i http://127.0.0.1:3000/api/health
```

وضعیت سالم:

```json
{"status":"ok","database":"ok"}
```

کد `503` با `database: "unavailable"` یعنی فایل SQLite وجود ندارد، قابل خواندن نیست یا اتصال runtime به آن برقرار نشده است.

## بررسی‌های اولیه‌ی incident

1. وضعیت process و پورت سرویس را بررسی کنید.
2. مقدار واقعی `PULSE_DB_PATH` را در محیط سرویس بررسی کنید؛ secretها را در log چاپ نکنید.
3. وجود فایل database و دسترسی read/write کاربر runtime به parent directory را بررسی کنید.
4. فضای دیسک و وجود فایل‌های `-wal` و `-shm` را بررسی کنید.
5. لاگ‌های آخر process را برای خطای `better-sqlite3` یا خطای schema بررسی کنید.
6. اگر database آسیب‌دیده یا ناقص است، سرویس را از ترافیک خارج و به restore procedure بروید.

## Backup سازگار با SQLite

Backup را در زمانی انجام دهید که فقط یک instance به database دسترسی نوشتن دارد. با ابزار SQLite از online backup استفاده کنید:

```bash
sqlite3 "$PULSE_DB_PATH" ".backup '/secure/backups/pulse-$(date +%Y%m%d-%H%M%S).sqlite'"
```

فایل backup را خارج از host سرویس و با دسترسی محدود نگهداری کنید. backup را با checksum و تاریخ ثبت کنید. کپی خام فایل اصلی بدون هماهنگی با journalهای SQLite قابل اتکا نیست.

برای اطمینان از backup:

```bash
sqlite3 /secure/backups/pulse-YYYYMMDD-HHMMSS.sqlite "PRAGMA integrity_check;"
```

خروجی مورد انتظار `ok` است.

## Restore

1. سرویس را متوقف و از load balancer خارج کنید.
2. از فایل فعلی database، در صورت امکان، یک کپی قرنطینه تهیه کنید.
3. integrity check فایل backup را اجرا کنید.
4. فایل restore شده را در مسیر دقیق `PULSE_DB_PATH` قرار دهید و مالکیت/permission را به کاربر runtime بدهید.
5. سرویس را راه‌اندازی کنید.
6. ابتدا `/api/health` و سپس login و یک مسیر خواندنی مجاز را بررسی کنید.
7. زمان restore، نام backup و نتیجه‌ی smoke check را در change record ثبت کنید.

هر restore ممکن است داده‌های ثبت‌شده پس از زمان backup را از بین ببرد؛ پیش از اجرا، دامنه و زمان بازیابی را ثبت و تأیید کنید.

## Restart و rollback

- restart فقط از طریق process manager محیط انجام شود.
- هنگام rollback، artifact برنامه را به نسخه‌ی قبلی برگردانید؛ database را به عقب برنگردانید مگر اینکه restore رسمی تأیید شده باشد.
- بعد از هر restart یا rollback، health check و login را تکرار کنید.

## امنیت عملیاتی

- `PULSE_ADMIN_PASSWORD` و سایر secretها در مخزن، command history یا log قرار نگیرند.
- در HTTPS مقدار `PULSE_HTTPS=true` تنظیم شود.
- فایل database و backupها public یا قابل دانلود از web root نباشند.
- دسترسی backupها به حداقل افراد و سرویس‌های لازم محدود شود.
- health endpoint عمداً اطلاعات هویتی، schema یا مسیر فایل را برنمی‌گرداند.
