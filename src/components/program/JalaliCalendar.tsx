"use client";

import { useMemo, useState } from "react";
import { daysInJalaliMonth, formatJalaliDate, JALALI_MONTHS, JALALI_WEEKDAYS, parseJalaliDate, shiftJalaliMonth } from "../../domain/program/calendar";

export function JalaliCalendar({ value, today, events = [], onChange }: { value?: string; today: string; events?: Array<{ date: string; label: string }>; onChange?: (date: string) => void }) {
  const parsed = parseJalaliDate(value ?? today) ?? [1405, 1, 1];
  const [cursor, setCursor] = useState({ year: parsed[0], month: parsed[1] });
  const days = useMemo(() => {
    const weekday = weekdayIndex(cursor.year, cursor.month, 1);
    const count = daysInJalaliMonth(cursor.year, cursor.month);
    return Array.from({ length: weekday + count }, (_, index) => index < weekday ? null : index - weekday + 1);
  }, [cursor]);
  const eventDays = new Map<string, string>();
  for (const event of events) {
    const parsedEventDate = parseJalaliDate(event.date);
    const normalizedEventDate = parsedEventDate ? formatJalaliDate(parsedEventDate[0], parsedEventDate[1], parsedEventDate[2]) : event.date;
    const priorLabel = eventDays.get(normalizedEventDate);
    eventDays.set(normalizedEventDate, priorLabel ? `${priorLabel}، ${event.label}` : event.label);
  }
  return <section className="jalali-calendar" aria-label="تقویم برنامه‌ریزی جلالی"><header><button type="button" className="calendar-nav" aria-label="ماه قبل" onClick={() => setCursor((current) => shiftJalaliMonth(current.year, current.month, -1))}>‹</button><div><strong>{JALALI_MONTHS[cursor.month - 1]}</strong><span>{cursor.year}</span></div><button type="button" className="calendar-nav" aria-label="ماه بعد" onClick={() => setCursor((current) => shiftJalaliMonth(current.year, current.month, 1))}>›</button></header><div className="calendar-weekdays">{JALALI_WEEKDAYS.map((day) => <span key={day}>{day.slice(0, 1)}</span>)}</div><div className="calendar-grid">{days.map((day, index) => { if (!day) return <span className="calendar-day empty-day" key={`empty-${index}`} />; const date = formatJalaliDate(cursor.year, cursor.month, day); const selected = date === value; const isToday = date === today; return <button type="button" key={date} className={`calendar-day${selected ? " selected" : ""}${isToday ? " today" : ""}${eventDays.has(date) ? " has-event" : ""}`} aria-label={eventDays.get(date) ? `${date}، ${eventDays.get(date)}` : date} onClick={() => onChange?.(date)}>{day}{eventDays.has(date) && <i aria-hidden="true" />}</button>; })}</div><button type="button" className="calendar-today" onClick={() => { const current = parseJalaliDate(today); if (current) setCursor({ year: current[0], month: current[1] }); onChange?.(today); }}>امروز</button></section>;
}

function weekdayIndex(year: number, month: number, day: number): number {
  const monthDays = month <= 6 ? (month - 1) * 31 : 186 + (month - 7) * 30;
  const yearDays = year - 1400;
  const gregorian = new Date(Date.UTC(2021, 2, 21 + yearDays * 365 + Math.floor((yearDays + 3) / 4) + monthDays + day - 1));
  return (gregorian.getUTCDay() + 1) % 7;
}
