// Derived Hours 2.0 state shared by the views: per-week summary + booking
// status, and the bank. Thin glue over the pure lib/hours2 modules.
import { summarizeWeek, earnedForWeek } from "../../lib/hours2/summary.js";
import { weekStartOf, addWeeks, addDaysISO } from "../../lib/hours2/week.js";
import { bankByCode, isConfirmed, isStale, countsForBank } from "../../lib/hours2/bank.js";
import { sumValues } from "../../lib/hours2/day.js";
import { toISO } from "../../lib/dateUtils.js";

export function clockContext(now) {
  return { todayISO: toISO(now), nowMin: now.getHours() * 60 + now.getMinutes() };
}

export function weekInfo(weekStart, store, ctx) {
  const { worklog, bookings, settings } = store;
  const summary = summarizeWeek(weekStart, worklog, settings, ctx);
  const booking = bookings[weekStart] || null;
  const confirmed = isConfirmed(booking);
  const gapMode = confirmed ? booking.gapMode : settings.gapMode;
  const earnedRes = earnedForWeek(summary, gapMode);
  const stale = confirmed && isStale(booking, earnedRes.earned);
  const currentWeek = weekStartOf(ctx.todayISO);
  const inBank = countsForBank(weekStart, settings.opening);
  let status;
  if (confirmed) status = stale ? "changed" : "booked";
  else if (weekStart === currentWeek) status = "current";
  else if (weekStart > currentWeek) status = "future";
  else status = "unbooked";
  return { weekStart, summary, booking, confirmed, gapMode, earnedRes, stale, inBank, status, isCurrent: weekStart === currentWeek };
}

// Every week from the earliest one with any data (worklog, a booking, or
// the opening balance) up to the current week, newest first.
export function weeksToShow(store, ctx) {
  const current = weekStartOf(ctx.todayISO);
  const candidates = [
    ...Object.keys(store.worklog).map(weekStartOf),
    ...Object.keys(store.bookings),
    store.settings.opening?.weekStart,
  ].filter((w) => w && w <= current);
  let first = candidates.length ? candidates.reduce((a, b) => (a < b ? a : b)) : current;
  const out = [];
  for (let w = current; w >= first; w = addWeeks(w, -1)) out.push(w);
  return out;
}

export function bankNow(store) {
  return bankByCode(store.settings.opening, Object.values(store.bookings));
}

export function bankBefore(store, weekStart) {
  return bankByCode(store.settings.opening, Object.values(store.bookings), { beforeWeekStart: weekStart });
}

export { sumValues, addDaysISO };
