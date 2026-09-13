/** Product-facing UX metadata. This is descriptive metadata, not domain state. */

export type UxDisclosureLevel = "simple" | "professional" | "advanced";
export type UxNavigationKind = "default" | "contextual" | "advanced" | "administrator";

export type ProductNavigationItem = {
  key: string;
  label: string;
  description: string;
  href: string;
  kind: UxNavigationKind;
  disclosure: UxDisclosureLevel;
  permission?: string;
};

export const PRODUCT_NAVIGATION: readonly ProductNavigationItem[] = [
  { key: "my-work", label: "کارهای من", description: "اقدام‌ها و مسئولیت‌های واگذار‌شده به شما", href: "/actions", kind: "default", disclosure: "simple", permission: "actions.view" },
  { key: "my-plan", label: "برنامه من", description: "برنامه، اهداف و مسیر کاری مرتبط با شما", href: "/program", kind: "default", disclosure: "simple", permission: "goals.view" },
  { key: "goals", label: "اهداف", description: "اهداف سازمان و واحدها", href: "/goals", kind: "default", disclosure: "professional", permission: "goals.view" },
  { key: "performance", label: "گزارش عملکرد", description: "پیشرفت، شاخص‌ها و وضعیت برنامه", href: "/reports", kind: "default", disclosure: "professional", permission: "reports.view" },
  { key: "follow-up", label: "پیگیری", description: "ریسک‌ها، وابستگی‌ها و بازبینی‌های دوره‌ای", href: "/monthly-reviews", kind: "contextual", disclosure: "professional", permission: "reports.view" },
  { key: "reports", label: "گزارش‌ها", description: "گزارش‌های قابل مشاهده و خروجی‌ها", href: "/reports", kind: "contextual", disclosure: "professional", permission: "reports.view" },
  { key: "administration", label: "مدیریت سامانه", description: "کاربران، واحدها، نقش‌ها، تنظیمات و ورود داده", href: "/settings", kind: "administrator", disclosure: "advanced", permission: "organization.manage" },
  { key: "domain-explorer", label: "نمای تخصصی داده‌ها", description: "دسترسی مستقیم به موجودیت‌ها و فراداده‌های دامنه", href: "/program", kind: "advanced", disclosure: "advanced", permission: "goals.view" }
] as const;

export const UX_DISCLOSURE_LABELS: Record<UxDisclosureLevel, string> = {
  simple: "ساده",
  professional: "حرفه‌ای",
  advanced: "پیشرفته"
};

export const USER_FACING_ENTITY_LABELS = {
  program: "برنامه",
  goal: "هدف",
  departmentalGoal: "هدف واحد",
  objective: "هدف جزئی",
  activity: "فعالیت",
  action: "کار / اقدام",
  kpi: "شاخص عملکرد",
  department: "واحد سازمانی",
  person: "شخص",
  role: "نقش سازمانی",
  risk: "ریسک",
  dependency: "وابستگی",
  monthlyReview: "بازبینی دوره‌ای",
  planCycle: "چرخه برنامه"
} as const;

export const HUMAN_ERROR_MESSAGES = {
  missingParent: "این مورد به یک مورد بالادستی نیاز دارد. از فهرست پیشنهادی، مورد مرتبط را انتخاب کنید.",
  permissionDenied: "شما اجازه انجام این کار را ندارید. اگر فکر می‌کنید باید دسترسی داشته باشید، با مدیر سامانه تماس بگیرید.",
  staleData: "اطلاعاتی که باز کرده‌اید تغییر کرده است. صفحه را تازه کنید و دوباره بررسی کنید.",
  network: "ارتباط با سامانه برقرار نشد. اتصال را بررسی کنید و دوباره تلاش کنید.",
  unexpected: "انجام این کار ممکن نشد. تغییرات شما حفظ نشده است؛ دوباره تلاش کنید یا با مسئول سامانه تماس بگیرید."
} as const;
