# مشخصات مفهومی Design System PULSE

این سند قرارداد آینده است، نه بازطراحی فعلی.

## توکن‌ها

توکن‌های رنگ باید semantic باشند (surface، text، border، action، success، warning، danger، info) و برای light/dark و contrast قابل سنجش تعریف شوند. typography باید خانواده فارسی خوانا، اندازه، وزن و line-height مشخص داشته باشد. spacing بر scale ثابت، radius محدود، elevation کم و معنی‌دار، و icon set یکدست با نام accessible باشد.

## مؤلفه‌ها و قواعد

| دسته | هدف و قاعده |
|---|---|
| Button | متن فعل‌محور؛ primary یکی در هر context؛ loading و disabled توضیح‌پذیر |
| Input/Select | label همیشه قابل مشاهده؛ help و error وابسته به input؛ انتخاب parent انسانی |
| Table/Card | جدول برای مقایسه، card برای خلاصه؛ mobile به stack تبدیل شود |
| Status/Progress | متن + آیکون + pattern؛ درصد بدون تفسیر رها نشود |
| Dialog/Drawer | برای تصمیم محدود؛ focus trap، escape و عنوان روشن |
| Navigation/Breadcrumb/Tabs | context و بازگشت؛ tab جای route پنهان نیست |
| Stepper | فرم‌های چندمرحله‌ای، نمایش مرحله فعلی و امکان بازگشت امن |
| Alert/Notification | severity، علت، action و dismiss روشن |
| Empty/Loading/Error | انتظار، دلیل و قدم بعدی؛ skeleton فقط وقتی layout را توضیح می‌دهد |

هر component باید keyboard, screen-reader, RTL, responsive, focus, validation و reduced-motion contract داشته باشد.
