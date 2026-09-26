// Per-code bank — see ARCHITECTURE.md §7 ("Hours 2.0").
//   bank[code] = opening[code] + Σ over confirmed weeks (earned − booked)
// using each booking's stored `earned` snapshot, so editing a day after
// booking never silently shifts the bank (the week is flagged instead).
import { bookedByCode } from "./booking.js";

export function addInto(target, map, sign = 1) {
  for (const [k, v] of Object.entries(map)) target[k] = (target[k] || 0) + sign * v;
  return target;
}

export function isConfirmed(booking) {
  return !!booking && !!booking.confirmedAt;
}

// Whether a week counts toward the bank at all: on/after the opening
// balance's week (everything counts when no opening is set).
export function countsForBank(weekStart, opening) {
  return !opening || !opening.weekStart || weekStart >= opening.weekStart;
}

// Bank from the opening balance plus every confirmed booking whose week is
// strictly before `beforeWeekStart` (all of them when omitted).
export function bankByCode(opening, bookings, { beforeWeekStart } = {}) {
  const bank = addInto({}, (opening && opening.perCode) || {});
  for (const b of bookings) {
    if (!isConfirmed(b)) continue;
    if (!countsForBank(b.weekStart, opening)) continue;
    if (beforeWeekStart && b.weekStart >= beforeWeekStart) continue;
    addInto(bank, b.earned || {});
    addInto(bank, bookedByCode(b.lines || []), -1);
  }
  return bank;
}

export function weekDelta(booking) {
  return addInto(addInto({}, booking.earned || {}), bookedByCode(booking.lines || []), -1);
}

function sameMap(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] || 0) !== (b[k] || 0)) return false;
  return true;
}

// A confirmed week is stale when what it earns now (recomputed from the
// current worklog with the booking's own gap mode) differs from the snapshot.
export function isStale(booking, earnedNow) {
  if (!isConfirmed(booking) || !earnedNow) return false;
  return !sameMap(booking.earned || {}, earnedNow);
}
