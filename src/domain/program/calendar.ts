import { normalizeProgramDigits } from "./primitives";

export const JALALI_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"] as const;
export const JALALI_WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"] as const;

export function isJalaliLeapYear(year: number): boolean {
  const epBase = year - (year >= 0 ? 474 : 473);
  const epYear = 474 + ((epBase % 2820) + 2820) % 2820;
  return (((epYear + 38) * 682) % 2816) < 682;
}

export function daysInJalaliMonth(year: number, month: number): number {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return isJalaliLeapYear(year) ? 30 : 29;
}

export function parseJalaliDate(value: string): [number, number, number] | null {
  const match = normalizeProgramDigits(value).trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInJalaliMonth(year, month)) return null;
  return [year, month, day];
}

export function formatJalaliDate(year: number, month: number, day: number): string { return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`; }

export function shiftJalaliMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + month - 1 + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 + 1 };
}
