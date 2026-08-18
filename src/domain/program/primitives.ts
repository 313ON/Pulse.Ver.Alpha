export type ProgramStatus =
  | "پیش‌نویس"
  | "نیازمند تکمیل"
  | "در انتظار تأیید"
  | "تأیید شده"
  | "شروع نشده"
  | "در حال اجرا"
  | "تکمیل شده"
  | "مسدود"
  | "متوقف شده"
  | "لغو شده";

export type Priority = "بحرانی" | "زیاد" | "متوسط" | "کم";

export type ProgramDate = string;

export type Progress = number & { readonly __brand: "Progress" };

export type KpiDirection = "higher-is-better" | "lower-is-better";

export type KpiMeasurement = {
  value: number;
  unit: string;
};

export type KpiMeasurementRule = {
  direction: KpiDirection;
  minimum?: number;
  maximum?: number;
  precision?: number;
};

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeProgramDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(digit);
    return persianIndex >= 0 ? String(persianIndex) : String(ARABIC_DIGITS.indexOf(digit));
  });
}

export function createProgress(value: number): Progress {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error("Progress must be an integer between 0 and 100.");
  }
  return value as Progress;
}

export function createProgramDate(value: string): ProgramDate {
  const normalized = normalizeProgramDigits(value).trim();
  if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(normalized)) {
    throw new Error("Program dates must use the Jalali YYYY/MM/DD format.");
  }
  return normalized;
}

export function createKpiMeasurement(value: number, unit: string): KpiMeasurement {
  if (!Number.isFinite(value)) throw new Error("KPI measurement values must be numeric.");
  if (!unit.trim()) throw new Error("KPI measurement units are required.");
  return { value, unit: unit.trim() };
}
