// Week summary — ties the per-day math together for one Mon–Sun week. See
// ARCHITECTURE.md §7 ("Hours 2.0"). Weekend days count toward paid/logged
// (so weekend work lands in the bank) but are never bookable.
import { weekDays, isWeekend } from "./week.js";
import { loggedByCode, paidMinutes, dayStatus, dayKind, isLeave, sumValues } from "./day.js";
import { earnedByCode } from "./earned.js";
import { addInto } from "./bank.js";

export const DEFAULT_SETTINGS = {
  id: "settings",
  bookableWeekMin: 2400,
  lunchMin: 30,
  gapMode: { kind: "proportional" },
  opening: null, // { weekStart, perCode: { codeId: minutes } }
};

export function dayMinutesFor(settings) {
  return Math.round(settings.bookableWeekMin / 5);
}

// worklog: { date: WorkDay }; todayISO/nowMin: for projecting today.
export function summarizeWeek(weekStart, worklog, settings, { todayISO, nowMin } = {}) {
  const lunchMin = settings.lunchMin;
  const dayMin = dayMinutesFor(settings);
  const days = weekDays(weekStart).map((date) => {
    const day = worklog[date] || null;
    const isToday = date === todayISO;
    const opts = { lunchMin, nowMin: isToday ? nowMin : undefined };
    const logged = loggedByCode(day, opts.nowMin);
    return {
      date,
      day,
      isToday,
      weekend: isWeekend(date),
      isFuture: !!todayISO && date > todayISO,
      status: dayStatus(day, { isToday, isPast: !!todayISO && date < todayISO }),
      kind: dayKind(day, opts),
      paid: paidMinutes(day, opts),
      loggedByCode: logged,
      logged: sumValues(logged),
      leave: !isWeekend(date) && isLeave(day),
    };
  });
  const loggedTotalByCode = {};
  for (const d of days) addInto(loggedTotalByCode, d.loggedByCode);
  const leaveDays = days.filter((d) => d.leave).length;
  const bookable = settings.bookableWeekMin - leaveDays * dayMin;
  const paid = days.reduce((s, d) => s + d.paid, 0);
  const logged = sumValues(loggedTotalByCode);
  return {
    weekStart,
    days,
    bookable,
    paid,
    logged,
    diff: paid - bookable,
    loggedByCode: loggedTotalByCode,
    loggedByDay: Object.fromEntries(days.map((d) => [d.date, d.loggedByCode])),
    bookingDays: days.filter((d) => !d.weekend).map((d) => ({ date: d.date, bookable: !d.leave })),
    incomplete: days.filter((d) => d.status === "incomplete").map((d) => d.date),
    open: days.filter((d) => d.status === "open").map((d) => d.date),
    dayMin,
  };
}

export function earnedForWeek(summary, gapMode) {
  return earnedByCode(summary.loggedByCode, summary.paid, gapMode);
}
