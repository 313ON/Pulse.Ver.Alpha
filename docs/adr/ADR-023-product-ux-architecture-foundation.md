# ADR-023: پایه معماری محصول و تجربه کاربر

## وضعیت

پذیرفته‌شده در 2026-09-13 برای مرحله foundation؛ اجرای UI در مرحله بعد.

## تصمیم

PULSE یک UX نیت‌محور با progressive disclosure خواهد داشت. لایه Presentation فقط intent کاربر را می‌گیرد؛ application service، domain rules و infrastructure مرزهای فعلی را حفظ می‌کنند. ناوبری پیش‌فرض بر «کارهای من، برنامه من، اهداف، عملکرد و پیگیری» سازمان می‌یابد و entity explorer، provenance و diagnostics در سطح پیشرفته باقی می‌مانند.

## دلیل

مدل فعلی کامل و permission-aware است، اما آشکارسازی مستقیم همه entityها بار شناختی زیادی برای کاربر عمومی دارد. یک بازنویسی UI یا تغییر مدل در این مرحله ریسک identity، provenance، governance و رفتار تاریخی را بالا می‌برد؛ metadata و قراردادهای مستند امکان اجرای تدریجی را می‌دهند.

## پیامدها

مسیرهای فعلی و domain model حفظ می‌شوند. فرم‌های آینده باید wizard و application-service based باشند. زبان فارسی و خطای انسانی قرارداد محصول است. multi-tenancy و AI مرزهای جداگانه دارند و فعلاً اجرا نمی‌شوند.

## ردشده‌ها

بازطراحی گسترده، schema change، identity change، direct persistence از UI و AI به‌عنوان authority در این مرحله رد شدند.
