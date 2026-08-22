# PULSE — راهنمای عملیات و بازیابی

## بررسی سلامت

```bash
curl -i http://127.0.0.1:3000/api/health
```

وضعیت سالم:

```json
{"status":"ok","database":"ok"}
```

کد `503` با `database: "unavailable"` یعنی فایل SQLite وجود ندارد، قابل خواندن نیست، integrity check ناموفق است، schema ناقص است یا اتصال runtime به آن برقرار نشده است.

Readiness علاوه بر `PRAGMA integrity_check`، قرارداد canonical موجود در
`db/schema.sqlite.sql` را بررسی می‌کند؛ شامل table، column، index، trigger،
foreign key، default و constraintهای مهم. خطای schema را با restore یا repair
database بررسی کنید و schema را به‌صورت دستی downgrade نکنید.

## بررسی‌های اولیه‌ی incident

1. وضعیت process و پورت سرویس را بررسی کنید.
2. مقدار واقعی `PULSE_DB_PATH` را در محیط سرویس بررسی کنید؛ secretها را در log چاپ نکنید.
3. وجود فایل database و دسترسی read/write کاربر runtime به parent directory را بررسی کنید.
4. فضای دیسک و وجود فایل‌های `-wal` و `-shm` را بررسی کنید.
5. لاگ‌های آخر process را برای خطای `better-sqlite3` یا خطای schema بررسی کنید.
6. اگر database آسیب‌دیده یا ناقص است، سرویس را از ترافیک خارج و به restore procedure بروید.

## Backup سازگار با SQLite روی Windows Server

Backup را در زمانی انجام دهید که فقط یک instance به database دسترسی نوشتن دارد.
روش approved، SQLite online backup است؛ raw copy فقط از `pulse.sqlite` در حالی
که WAL فعال است approved نیست. می‌توان از SQLite command-line موجود روی سرور
استفاده کرد:

```bash
sqlite3 "$PULSE_DB_PATH" ".backup '/secure/backups/pulse-$(date +%Y%m%d-%H%M%S).sqlite'"
```

روی Windows، مسیر مقصد را به مسیر approved backup تبدیل کنید و timestamp را با
فرمت `yyyyMMdd-HHmmss` ثبت کنید. فایل backup را خارج از release directory و با
ACL محدود نگهداری کنید. checksum و تاریخ backup را ثبت کنید.

ترتیب عملیاتی:

```text
BACKUP → integrity_check → foreign_key_check → schema readiness → checksum → retention
```

برای اطمینان از backup:

```bash
sqlite3 /secure/backups/pulse-YYYYMMDD-HHMMSS.sqlite "PRAGMA integrity_check;"
```

خروجی مورد انتظار `ok` است.

برای restore test دوره‌ای، backup را به مسیر disposable جدا restore کنید و
همین checks را به‌علاوه‌ی login، reporting و import persistence اجرا کنید.

## Restore

1. سرویس را متوقف و از load balancer خارج کنید.
2. از فایل فعلی database، در صورت امکان، یک کپی قرنطینه تهیه کنید.
3. integrity check فایل backup را اجرا کنید.
4. فایل restore شده را در مسیر دقیق `PULSE_DB_PATH` قرار دهید و مالکیت/permission را به کاربر runtime بدهید.
5. سرویس را راه‌اندازی کنید.
6. ابتدا `/api/health` و سپس login و یک مسیر خواندنی مجاز را بررسی کنید.
7. زمان restore، نام backup و نتیجه‌ی smoke check را در change record ثبت کنید.

فایل restore شده باید خارج از application/release directory قرار گیرد و ACL آن
برای service account مطابق database اصلی تنظیم شود. فایل‌های `-wal` و `-shm`
را جداگانه کپی نکنید؛ online backup باید snapshot سازگار تولید کند.

هر restore ممکن است داده‌های ثبت‌شده پس از زمان backup را از بین ببرد؛ پیش از اجرا، دامنه و زمان بازیابی را ثبت و تأیید کنید.

## Restart و rollback

- restart فقط از طریق process manager محیط انجام شود.
- هنگام rollback، artifact برنامه را به نسخه‌ی قبلی برگردانید؛ database را به عقب برنگردانید مگر اینکه restore رسمی تأیید شده باشد.
- بعد از هر restart یا rollback، health check و login را تکرار کنید.
- restart persistence check: پس از یک write، process را کامل ببندید، دوباره
  راه‌اندازی کنید و همان record، readiness، login و reporting را بررسی کنید.
- rollback برنامه بدون rollback schema انجام شود، مگر اینکه compatibility
  نسخه‌ی قبلی با schema فعلی اثبات شده باشد. برای schema rollback فقط backup
  verified و maintenance window مجاز است.

## Operational verification checklist

- `PULSE_DB_PATH` absolute و خارج از release directory است.
- parent directory database برای service account read/write است.
- release directory برای service account read/execute است.
- فقط یک writer process برای فایل فعال است.
- `journal_mode=wal` و `synchronous=FULL` مشاهده شده‌اند.
- `foreign_keys=1` و `busy_timeout=5000` روی writer و read-only connection مشاهده شده‌اند.
- backup با online backup ساخته و با integrity/FK/schema checks تأیید شده است.
- restore test و restart persistence test ثبت شده‌اند.
- مسیر واقعی service manager، account، ACL و backup retention در change record ثبت شده‌اند.

## امنیت عملیاتی

- `PULSE_ADMIN_PASSWORD` و سایر secretها در مخزن، command history یا log قرار نگیرند.
- تغییر `PULSE_ADMIN_PASSWORD`، password کاربر `admin` موجود را تغییر نمی‌دهد.
  برای rotation از مسیر secure password rotation استفاده کنید تا hash جدید با
  salt تازه تولید شود؛ plaintext یا hash در log ثبت نشود.
- در HTTPS مقدار `PULSE_HTTPS=true` تنظیم شود.
- `PULSE_HTTPS=true` فقط برای TLS termination تأییدشده در reverse proxy یا load balancer
  تنظیم شود؛ این متغیر جایگزین certificate، redirect یا HTTPS listener نیست.
- فایل database و backupها public یا قابل دانلود از web root نباشند.
- دسترسی backupها به حداقل افراد و سرویس‌های لازم محدود شود.
- health endpoint عمداً اطلاعات هویتی، schema یا مسیر فایل را برنمی‌گرداند.
- health endpoint با `Cache-Control: no-store` پاسخ می‌دهد و نباید cache شود.
