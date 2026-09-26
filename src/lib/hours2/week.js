// Week/workday helpers for Hours 2.0 — see ARCHITECTURE.md §7 ("Hours 2.0").
// Weeks are keyed by their Monday as an ISO date string; only Mon–Fri are
// workdays (weekends are never shown or counted).
import { toISO, parseISODate, addDays, startOfWeekMonday } from "../dateUtils.js";

export const WORKDAYS_PER_WEEK = 5;

export function weekStartOf(dateOrISO) {
  const d = typeof dateOrISO === "string" ? parseISODate(dateOrISO) : dateOrISO;
  return toISO(startOfWeekMonday(d));
}

export function addWeeks(weekStartISO, n) {
  return toISO(addDays(parseISODate(weekStartISO), 7 * n));
}

export function addDaysISO(iso, n) {
  return toISO(addDays(parseISODate(iso), n));
}

export function workdays(weekStartISO) {
  return Array.from({ length: WORKDAYS_PER_WEEK }, (_, i) => addDaysISO(weekStartISO, i));
}

export function isWeekend(iso) {
  const day = parseISODate(iso).getDay();
  return day === 0 || day === 6;
}

// ISO-8601 week number (weeks start Monday; week 1 holds the year's first
// Thursday).
export function isoWeekNumber(iso) {
  const d = parseISODate(iso);
  const thursday = addDays(d, 3 - ((d.getDay() + 6) % 7));
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  return 1 + Math.floor(Math.round((thursday - jan1) / 86400000) / 7);
}

// Fixed names rather than toLocaleDateString — newer ICU data renders en-GB
// September as "sept", which would make labels vary by browser.
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function monthShort(d) {
  return MONTHS[d.getMonth()];
}

// "22–26 sep" / "29 sep – 3 oct" — the Mon–Fri span.
export function weekRangeLabel(weekStartISO) {
  const start = parseISODate(weekStartISO);
  const end = addDays(start, WORKDAYS_PER_WEEK - 1);
  if (start.getMonth() === end.getMonth()) return `${start.getDate()}–${end.getDate()} ${monthShort(start)}`;
  return `${start.getDate()} ${monthShort(start)} – ${end.getDate()} ${monthShort(end)}`;
}

export function weekLabel(weekStartISO) {
  return `wk ${isoWeekNumber(weekStartISO)} · ${weekRangeLabel(weekStartISO)}`;
}

// "mon 22"
export function dayLabel(iso) {
  const d = parseISODate(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
}
