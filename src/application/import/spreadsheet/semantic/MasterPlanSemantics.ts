import type { ImportRecord } from "../../contracts";
import { normalizeImportText } from "../../normalization";

export function normalizeSemanticText(value: unknown): string {
  const text = normalizeImportText(String(value ?? ""))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ")
    .replace(/^\s*\d+\s*[-–—.)]\s*/u, "")
    .replace(/[.،,؛;:]+$/u, "")
    .replace(/هوشمند\s+سازی/gu, "هوشمندسازی")
    .replace(/فرآیندها/gu, "فرایندها")
    .replace(/بهره\s+وری/gu, "بهره وری")
    .replace(/زیر\s+ساخت/gu, "زیرساخت")
    .replace(/هدف از این فعالیت\s*:\s*.*/u, "")
    .replace(/\([^)]*\)/gu, "")
    .replace(/مربوط به/gu, "")
    .replace(/کارخانه$/u, "")
    .replace(/افزایش میزان اصول ایمنی و بهداشت حرفه ای/gu, "ارتقاء بهداشت حرفه ای و ایمنی پرسنل و تجهیزات در فعالیت های شرکت")
    .replace(/افزایش دانش و مهارت$/gu, "افزایش دانش و مهارت های عمومی تخصصی و شغلی پرسنل و اشاعه فرهنگ کار گروهی")
    .replace(/ارتقا/gu, "ارتقاء")
    .replace(/افزایش بهره وری امکانات و تجهیزات/gu, "افزایش بهره وری از امکانات و تجهیزات")
    .replace(/هوشمند سازی فرآیند ها و تجهیزات/gu, "هوشمندسازی فرایندها و تجهیزات شرکت")
    .replace(/هوشمند سازی فرآیندها و تجهیزات شرکت/gu, "هوشمندسازی فرایندها و تجهیزات شرکت")
    .replace(/هوشمندسازی فرایندها و تجهیزات کارخانه/gu, "هوشمندسازی فرایندها و تجهیزات شرکت")
    .replace(/هوشمندسازی فرآیندها و تجهیزات کارخانه/gu, "هوشمندسازی فرایندها و تجهیزات شرکت")
    .replace(/معرفی چرب شیمی به عنوان شرکت دانش محور با تکیه بر نیروی انسانی و فرآیندهای مربوط به تولید و نت.*اشاعه برند شرکت در بازارهای داخلی/gu, "معرفی شرکت چرب شیمی به عنوان شرکت دانش محور با تکیه بر نیروی انسانی و فرآیندهای تولید و نت و اشاعه برند شرکت در بازارهای داخلی")
    .replace(/کاهش پرت حامل های انرژی و آب/gu, "کاهش پرت حامل‌های انرژی و تکمیل چرخه بازیافت در کارخانه")
    .replace(/توسعه utilit امکانات و تجهیزات برای ایجاد زیر ساخت و افزایش ظرفیت و توان/giu, "توسعه یوتیلیتی امکانات و تجهیزات لازم برای ایجاد زیرساخت در جهت افزایش توان و ظرفیت تولید محصولات جدید")
    .replace(/\s+/g, " ").trim().toLocaleLowerCase();
  if (text === "هدف اصلی") return "";
  if (text.includes("تکمیل چرخه آزمایشگاهی")) return "goal:lab-cycle";
  if (text.includes("دستیابی به تولید و فروش")) return "goal:planned-production";
  if (text.includes("توسعه") && (text.includes("یوتیلیتی") || text.includes("utilit"))) return "goal:utilities";
  if (text.includes("افزایش دانش") || text === "افزایش دانش و مهارت") return "goal:knowledge";
  if (text.includes("کاهش پرت حامل")) return "goal:energy-waste";
  if (text.includes("افزایش بهره") && text.includes("امکانات")) return "goal:equipment-productivity";
  if ((text.includes("ارتقا") || text.includes("ارتقاء")) && text.includes("بهداشت حرفه")) return "goal:health-safety";
  if (text.includes("معرفی") && text.includes("دانش محور")) return "goal:knowledge-company";
  if (text.includes("هوشمند") && (text.includes("فرایند") || text.includes("فرآیند"))) return "goal:smart-processes";
  if (text.includes("حفظ محیط زیست")) return "goal:environment";
  return text;
}

export type MasterPlanDiscovery = {
  goals: string[];
  objectives: string[];
  activities: string[];
  actions: ImportRecord[];
  duplicates: string[];
};

export function discoverMasterPlan(records: ImportRecord[]): MasterPlanDiscovery {
  const goals = new Map<string, string>();
  const objectives = new Map<string, string>();
  const activities = new Map<string, string>();
  const duplicates: string[] = [];
  for (const record of records) {
    for (const [field, target] of [["goal", goals], ["objective", objectives], ["activity", activities]] as const) {
      const value = String(record.data[field] ?? "").trim();
      if (!value || value === "هدف اصلی") continue;
      const key = normalizeSemanticText(value);
      if (!key) continue;
      if (target.has(key) && target.get(key) !== value) duplicates.push(`${field}:${value}`);
      else target.set(key, value);
    }
  }
  return { goals: [...goals.values()].sort(), objectives: [...objectives.values()].sort(), activities: [...activities.values()].sort(), actions: records.filter((record) => record.entityType === "action"), duplicates: [...new Set(duplicates)].sort() };
}
