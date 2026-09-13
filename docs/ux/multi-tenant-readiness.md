# یادداشت آمادگی چندمستاجری

اجرای multi-tenant در این مرحله انجام نمی‌شود. مرز آینده باید چنین باشد:

`Organization → Users → Units → Plans → Domain data → Permissions → Audit`

تمام رکوردهای دامنه، session، import، snapshot، report و audit در آینده باید یک organization context معتبر داشته باشند. repository/application service باید tenant context را از مسیر trusted session بگیرند، نه از input قابل جعل. هر query، unique constraint، cache، export، search و background job باید با tenant scope محدود شود. هیچ شناسه‌ای به‌تنهایی مجوز cross-tenant نیست.

مدل فعلی role و DataScope پایه مناسبی برای این جداسازی است، اما organization_id، provisioning، migration، tenant-aware observability و آزمون isolation باید در ADR و طراحی جداگانه تصویب شوند. تا آن زمان افزودن ستون یا seed چندمستاجری بدون نیاز اجرایی ممنوع است.
