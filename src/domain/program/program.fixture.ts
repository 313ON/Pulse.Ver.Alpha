import { createProgress } from "./primitives";
import type { Program } from "./types";

export const programFixture: Program = {
  id: "program-1405",
  type: "program",
  title: "برنامه سالانه تحول دیجیتال ۱۴۰۵",
  description: "نقشه اجرایی یکپارچه تحول دیجیتال سازمان در چرخه برنامه‌ریزی سالانه",
  status: "در حال اجرا",
  owner: "مدیر تحول دیجیتال",
  priority: "بحرانی",
  timeline: { start: "۱۴۰۵/۰۱/۰۱", end: "۱۴۰۵/۱۲/۲۹" },
  progress: createProgress(62),
  goals: [
    {
      id: "goal-it-infrastructure",
      type: "goal",
      programId: "program-1405",
      title: "ارتقای زیرساخت فناوری اطلاعات",
      description: "ایجاد زیرساخت امن، پایدار و قابل توسعه برای عملیات سازمان",
      status: "در حال اجرا",
      owner: "معاونت فناوری اطلاعات",
      priority: "زیاد",
      timeline: { start: "۱۴۰۵/۰۱/۱۵", end: "۱۴۰۵/۰۹/۳۰" },
      progress: createProgress(68),
      objectives: [
        {
          id: "objective-network-security",
          type: "objective",
          goalId: "goal-it-infrastructure",
          title: "افزایش امنیت و پایداری شبکه",
          description: "کاهش نقاط آسیب‌پذیر و افزایش دسترس‌پذیری سرویس‌های حیاتی",
          status: "در حال اجرا",
          owner: "مدیر شبکه و امنیت",
          priority: "بحرانی",
          timeline: { start: "۱۴۰۵/۰۲/۰۱", end: "۱۴۰۵/۰۶/۳۱" },
          progress: createProgress(54),
          activities: [
            {
              id: "activity-security-architecture",
              type: "activity",
              objectiveId: "objective-network-security",
              title: "پیاده‌سازی معماری امنیت شبکه",
              description: "طراحی و استقرار لایه‌های کنترل، پایش و پاسخ‌گویی امنیتی",
              status: "در حال اجرا",
              owner: "تیم زیرساخت",
              priority: "زیاد",
              timeline: { start: "۱۴۰۵/۰۲/۱۵", end: "۱۴۰۵/۰۵/۳۰" },
              progress: createProgress(42),
              actions: [
                {
                  id: "action-firewall",
                  type: "action",
                  activityId: "activity-security-architecture",
                  title: "خرید و نصب Firewall",
                  description: "تأمین، نصب و پیکربندی فایروال مرزی سازمان",
                  status: "در حال اجرا",
                  owner: "کارشناس امنیت شبکه",
                  priority: "بحرانی",
                  timeline: { start: "۱۴۰۵/۰۳/۰۱", end: "۱۴۰۵/۰۴/۱۵" },
                  progress: createProgress(72),
                  kpis: [
                    {
                      id: "kpi-firewall-availability",
                      type: "kpi",
                      actionId: "action-firewall",
                      title: "دسترس‌پذیری لایه مرزی",
                      description: "نسبت زمان در دسترس بودن سرویس امنیتی",
                      status: "در حال اجرا",
                      owner: "مرکز عملیات شبکه",
                      priority: "زیاد",
                      timeline: { start: "۱۴۰۵/۰۳/۰۱", end: "۱۴۰۵/۱۲/۲۹" },
                      progress: createProgress(91),
                      unit: "٪",
                      target: 99.5,
                      actual: 98.7,
                      direction: "higher-is-better"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          id: "objective-data-governance",
          type: "objective",
          goalId: "goal-it-infrastructure",
          title: "استقرار حکمرانی داده و گزارش‌پذیری",
          description: "ایجاد زبان مشترک داده برای تصمیم‌گیری مدیریتی",
          status: "پیش‌نویس",
          owner: "دفتر داده و هوش تجاری",
          priority: "متوسط",
          timeline: { start: "۱۴۰۵/۰۵/۰۱", end: "۱۴۰۵/۱۰/۳۰" },
          progress: createProgress(28),
          activities: []
        }
      ]
    },
    {
      id: "goal-process-excellence",
      type: "goal",
      programId: "program-1405",
      title: "هوشمندسازی فرآیندهای سازمانی",
      description: "کاهش اصطکاک عملیاتی با بازطراحی و دیجیتال‌سازی فرآیندها",
      status: "در حال اجرا",
      owner: "دفتر تحول سازمانی",
      priority: "زیاد",
      timeline: { start: "۱۴۰۵/۰۱/۲۰", end: "۱۴۰۵/۱۱/۳۰" },
      progress: createProgress(56),
      objectives: []
    }
  ]
};
