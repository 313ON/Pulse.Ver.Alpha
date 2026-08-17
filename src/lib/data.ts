export type Health = "سبز" | "زرد" | "قرمز" | "خاکستری";
export type ActionStatus = "شروع نشده" | "در حال اجرا" | "تکمیل شده" | "مسدود" | "لغو شده";
export const currentPlanDate = "۱۴۰۵/۰۵/۲۶";

export const goals = [
  ["G01", "تکمیل چرخه آزمایشگاهی، پایلوت و تولید محصولات جدید", 68, "سبز"],
  ["G02", "دستیابی به تولید و فروش برنامه‌ریزی‌شده", 74, "سبز"],
  ["G03", "توسعه یوتیلیتی، امکانات و تجهیزات لازم برای افزایش توان و ظرفیت تولید محصولات جدید", 49, "زرد"],
  ["G04", "افزایش دانش و مهارت‌های عمومی، تخصصی و شغلی پرسنل و اشاعه فرهنگ کار گروهی", 81, "سبز"],
  ["G05", "کاهش پرت حامل‌های انرژی و تکمیل چرخه بازیافت در کارخانه", 56, "زرد"],
  ["G06", "افزایش بهره‌وری از امکانات و تجهیزات", 63, "سبز"],
  ["G07", "ارتقاء بهداشت حرفه‌ای و ایمنی پرسنل و تجهیزات", 88, "سبز"],
  ["G08", "حفظ محیط زیست و توسعه فضای سبز و زیباسازی محیط شرکت", 42, "زرد"],
  ["G09", "معرفی چرب شیمی به عنوان شرکت دانش‌محور با تکیه بر نیروی انسانی و فرآیندهای تولید و نت و اشاعه برند شرکت در بازارهای داخلی", 37, "قرمز"],
  ["G10", "هوشمندسازی فرآیندها و تجهیزات کارخانه", 71, "سبز"]
] as const;

export const departments = [
  ["تولید", "۱۸ اقدام", 78, "سبز", "۴", "مهندس شیمی - تولید"],
  ["نت / نگهداری و تعمیرات", "۲۲ اقدام", 61, "زرد", "۶", "مهندس مکانیک - نت"],
  ["آزمایشگاه و R&D", "۱۴ اقدام", 69, "سبز", "۳", "مهندس محصول - پایلوت / تحقیق و توسعه"],
  ["فناوری اطلاعات", "۱۱ اقدام", 72, "سبز", "۲", "مهندس فناوری اطلاعات"],
  ["تدارکات", "۹ اقدام", 47, "زرد", "۳", "—"],
  ["اداری و منابع انسانی", "۸ اقدام", 84, "سبز", "۲", "—"]
] as const;

export const actions = [
  { id: "G10-O02-A01-T001", title: "اتصال کنتورهای خط تولید به داشبورد هوشمند", goal: "G10", department: "فناوری اطلاعات", owner: "مهندس فناوری اطلاعات", status: "در حال اجرا" as ActionStatus, progress: 72, due: "۱۴۰۵/۰۶/۲۸", overdue: false, health: "سبز" as Health, deliverable: "داشبورد مصرف و هشدار لحظه‌ای" },
  { id: "G06-O01-A03-T002", title: "اجرای PM ماهانه تجهیزات بحرانی", goal: "G06", department: "نت / نگهداری و تعمیرات", owner: "مهندس مکانیک - نت", status: "مسدود" as ActionStatus, progress: 45, due: "۱۴۰۵/۰۵/۳۰", overdue: true, health: "قرمز" as Health, deliverable: "گزارش PM و کاهش توقفات" },
  { id: "G01-O02-A02-T001", title: "تکمیل تولید آزمایشی محصول پایه جدید", goal: "G01", department: "آزمایشگاه و R&D", owner: "مهندس محصول - پایلوت / تحقیق و توسعه", status: "در حال اجرا" as ActionStatus, progress: 68, due: "۱۴۰۵/۰۶/۲۰", overdue: false, health: "زرد" as Health, deliverable: "نمونه تأییدشده و گزارش فنی" },
  { id: "G02-O01-A01-T004", title: "به‌روزرسانی برنامه تولید ماهانه", goal: "G02", department: "تولید", owner: "مهندس شیمی - تولید", status: "تکمیل شده" as ActionStatus, progress: 100, due: "۱۴۰۵/۰۶/۱۰", overdue: false, health: "سبز" as Health, deliverable: "برنامه تولید مصوب" },
  { id: "G05-O01-A02-T001", title: "اندازه‌گیری پرت بخار و تعریف اقدام اصلاحی", goal: "G05", department: "نت / نگهداری و تعمیرات", owner: "مهندس مکانیک - نت", status: "شروع نشده" as ActionStatus, progress: 0, due: "۱۴۰۵/۰۶/۱۸", overdue: false, health: "خاکستری" as Health, deliverable: "گزارش اندازه‌گیری و اقدام اصلاحی" },
  { id: "G07-O02-A01-T003", title: "بازبینی ماهانه تجهیزات حفاظت فردی", goal: "G07", department: "اداری و منابع انسانی", owner: "کارشناس منابع انسانی", status: "در حال اجرا" as ActionStatus, progress: 82, due: "۱۴۰۵/۰۶/۲۲", overdue: false, health: "سبز" as Health, deliverable: "چک‌لیست و صورتجلسه ایمنی" }
];

export const kpis = [
  ["نرخ تحقق برنامه تولید", "تولید", "۷۸٪", "۸۵٪", "زرد"],
  ["دسترس‌پذیری تجهیزات بحرانی", "نت", "۹۲٪", "۹۰٪", "سبز"],
  ["درصد تکمیل اقدامات PM", "نت", "۶۴٪", "۸۰٪", "قرمز"],
  ["کاهش مصرف انرژی به ازای محصول", "کارخانه", "۱۲٪", "۱۵٪", "زرد"]
] as const;

export const actionRecords = [
  { publicId: "G10-O02-A01-T001", goalId: "G10", title: "اتصال کنتورهای خط تولید به داشبورد هوشمند", workType: "پروژه" as const, departmentId: "it", ownerPersonId: "it-engineer", owner: "مهندس فناوری اطلاعات", department: "فناوری اطلاعات", status: "در حال اجرا" as ActionStatus, progress: 72, deadline: "۱۴۰۵/۰۶/۲۸", deliverable: "داشبورد مصرف و هشدار لحظه‌ای" },
  { publicId: "G06-O01-A03-T002", goalId: "G06", title: "اجرای PM ماهانه تجهیزات بحرانی", workType: "اقدام" as const, departmentId: "maintenance", ownerPersonId: "maintenance-engineer", owner: "مهندس مکانیک - نت", department: "نت / نگهداری و تعمیرات", status: "مسدود" as ActionStatus, progress: 45, deadline: "۱۴۰۵/۰۵/۳۰", deliverable: "گزارش PM و کاهش توقفات" },
  { publicId: "G01-O02-A02-T001", goalId: "G01", title: "تکمیل تولید آزمایشی محصول پایه جدید", workType: "پروژه" as const, departmentId: "rnd", ownerPersonId: "product-engineer", owner: "مهندس محصول - پایلوت / تحقیق و توسعه", department: "آزمایشگاه و R&D", status: "در حال اجرا" as ActionStatus, progress: 68, deadline: "۱۴۰۵/۰۶/۲۰", deliverable: "نمونه تأییدشده و گزارش فنی" },
  { publicId: "G02-O01-A01-T004", goalId: "G02", title: "به‌روزرسانی برنامه تولید ماهانه", workType: "اقدام" as const, departmentId: "production", ownerPersonId: "production-engineer", owner: "مهندس شیمی - تولید", department: "تولید", status: "تکمیل شده" as ActionStatus, progress: 100, deadline: "۱۴۰۵/۰۶/۱۰", deliverable: "برنامه تولید مصوب" },
  { publicId: "G05-O01-A02-T001", goalId: "G05", title: "اندازه‌گیری پرت بخار و تعریف اقدام اصلاحی", workType: "اقدام" as const, departmentId: "maintenance", ownerPersonId: "maintenance-engineer", owner: "مهندس مکانیک - نت", department: "نت / نگهداری و تعمیرات", status: "شروع نشده" as ActionStatus, progress: 0, deadline: "۱۴۰۵/۰۶/۱۸", deliverable: "گزارش اندازه‌گیری و اقدام اصلاحی" },
  { publicId: "G07-O02-A01-T003", goalId: "G07", title: "بازبینی ماهانه تجهیزات حفاظت فردی", workType: "فعالیت تکرارشونده" as const, departmentId: "hr", ownerPersonId: "hr-specialist", owner: "کارشناس منابع انسانی", department: "اداری و منابع انسانی", status: "در حال اجرا" as ActionStatus, progress: 82, deadline: "۱۴۰۵/۰۶/۲۲", deliverable: "چک‌لیست و صورتجلسه ایمنی" }
] as const;

export const dependencyRecords = [
  { sourceWorkItemId: "G10-O02-A01-T001", targetWorkItemId: "G06-O01-A03-T002", status: "باز" as const, delayDays: 4 }
];

export const kpiRecords = [
  { id: "kpi-production", name: "نرخ تحقق برنامه تولید", actual: 78, target: 85, direction: "higher-is-better" as const },
  { id: "kpi-availability", name: "دسترس‌پذیری تجهیزات بحرانی", actual: 92, target: 90, direction: "higher-is-better" as const },
  { id: "kpi-pm", name: "درصد تکمیل اقدامات PM", actual: 64, target: 80, direction: "higher-is-better" as const },
  { id: "kpi-energy", name: "کاهش مصرف انرژی به ازای محصول", actual: 12, target: 15, direction: "higher-is-better" as const }
];

export const riskRecords = [
  { id: "risk-maintenance", title: "تأخیر در تأمین قطعه تجهیزات بحرانی", probability: 4, impact: 5, status: "باز" as const, responseAction: "تأمین‌کننده جایگزین" },
  { id: "risk-energy", title: "پرت بالاتر از هدف حامل‌های انرژی", probability: 3, impact: 4, status: "باز" as const, responseAction: "اندازه‌گیری و اقدام اصلاحی" },
  { id: "risk-rnd", title: "تأخیر در تأیید نمونه محصول جدید", probability: 3, impact: 3, status: "کنترل‌شده" as const, responseAction: "جلسه هفتگی پایلوت" }
];
