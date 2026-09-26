// Booking proposal + validation — see ARCHITECTURE.md §7 ("Hours 2.0").
// Bookings are per workday per code, in 30m units, 8h per bookable workday
// (0 on leave days), always summing to the week's bookable hours.
import { apportion } from "./earned.js";

export const UNIT_MIN = 30;

// days: [{ date, bookable: boolean }]; loggedByDay: { date: { codeId: min } }
// earned/bank: { codeId: min }. Returns lines [{date, codeId, minutes}].
// Target per code = max(0, earned + bank) — book what was earned plus what's
// owed from earlier weeks — scaled to the bookable total and rounded to 30m
// units (largest remainder, so it sums exactly). Whatever doesn't fit stays
// in the bank by itself, since the bank is earned − booked.
export function proposeBooking({ earned, bank = {}, days, loggedByDay = {}, dayMin = 480 }) {
  const unitsPerDay = Math.round(dayMin / UNIT_MIN);
  const bookableDays = days.filter((d) => d.bookable);
  const totalUnits = unitsPerDay * bookableDays.length;
  const codes = new Set([...Object.keys(earned), ...Object.keys(bank)]);
  const target = {};
  for (const c of codes) target[c] = Math.max(0, (earned[c] || 0) + (bank[c] || 0));
  const units = apportion(target, totalUnits);
  if (!units || totalUnits === 0) return [];

  const remaining = { ...units };
  const cap = Object.fromEntries(bookableDays.map((d) => [d.date, unitsPerDay]));
  const cells = {}; // `${date}|${code}` -> units
  const give = (date, code, n) => {
    if (n <= 0) return;
    const key = `${date}|${code}`;
    cells[key] = (cells[key] || 0) + n;
    remaining[code] -= n;
    cap[date] -= n;
  };

  // Pass 1: each day first gets the codes actually logged on it, by that
  // day's logged time (rounded to units), largest first.
  for (const { date } of bookableDays) {
    const logged = loggedByDay[date] || {};
    const order = Object.keys(logged).sort((a, b) => logged[b] - logged[a] || (a < b ? -1 : 1));
    for (const code of order) {
      if (!(code in remaining)) continue;
      const want = Math.round(logged[code] / UNIT_MIN);
      give(date, code, Math.min(want, remaining[code], cap[date]));
    }
  }
  // Pass 2: fill what's left, day by day, from the codes with most left.
  for (const { date } of bookableDays) {
    while (cap[date] > 0) {
      const code = Object.keys(remaining)
        .filter((c) => remaining[c] > 0)
        .sort((a, b) => remaining[b] - remaining[a] || (a < b ? -1 : 1))[0];
      if (!code) break;
      give(date, code, Math.min(remaining[code], cap[date]));
    }
  }

  const lines = [];
  for (const { date } of days) {
    for (const code of Object.keys(units).sort()) {
      const n = cells[`${date}|${code}`];
      if (n) lines.push({ date, codeId: code, minutes: n * UNIT_MIN });
    }
  }
  return lines;
}

export function bookedByCode(lines) {
  const out = {};
  for (const l of lines) out[l.codeId] = (out[l.codeId] || 0) + l.minutes;
  return out;
}

export function bookedByDay(lines) {
  const out = {};
  for (const l of lines) out[l.date] = (out[l.date] || 0) + l.minutes;
  return out;
}

// Returns a list of human-readable problems; empty = valid.
export function validateBooking(lines, days, { dayMin = 480 } = {}) {
  const errors = [];
  const perDay = bookedByDay(lines);
  const known = new Set(days.map((d) => d.date));
  for (const l of lines) {
    if (!known.has(l.date)) errors.push(`${l.date} isn't a workday of this week`);
    if (l.minutes < 0 || l.minutes % UNIT_MIN !== 0) errors.push(`${l.date}: ${l.minutes}m isn't a multiple of ${UNIT_MIN}m`);
  }
  for (const d of days) {
    const got = perDay[d.date] || 0;
    const want = d.bookable ? dayMin : 0;
    if (got !== want) errors.push(`${d.date}: booked ${got / 60}h, needs ${want / 60}h`);
  }
  return errors;
}

// Sets one (date, code) cell, dropping zero lines — used by the booking grid.
export function setCell(lines, date, codeId, minutes) {
  const rest = lines.filter((l) => !(l.date === date && l.codeId === codeId));
  if (minutes > 0) rest.push({ date, codeId, minutes });
  return rest;
}
