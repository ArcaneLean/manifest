// Per-day Hours 2.0 math — see ARCHITECTURE.md §7 ("Hours 2.0"). Pure: no
// IndexedDB/React. A day is a WorkDay:
//   { date, officeIn?, officeOut?, officeLunch?, dayOff?, segments: [{start, end, codeId}] }
// `codeId: null` is a break. Times are local "HH:MM"; `nowMin` (minutes since
// midnight) is passed only for today, to project open segments / an open
// office visit up to now.
import { timeToMinutes } from "../timeUtils.js";

export const DEFAULT_LUNCH_MIN = 30;

export function isLeave(day) {
  return !!day && day.dayOff === "leave";
}

function segmentBounds(seg, nowMin) {
  const start = timeToMinutes(seg.start);
  if (start === null) return null;
  let end = seg.end ? timeToMinutes(seg.end) : nowMin;
  if (end === null || end === undefined) return null;
  if (end < start) end = start;
  return [start, end];
}

function officeBounds(day, nowMin) {
  if (!day || !day.officeIn) return null;
  const start = timeToMinutes(day.officeIn);
  let end = day.officeOut ? timeToMinutes(day.officeOut) : nowMin;
  if (end === null || end === undefined) return null;
  if (end < start) end = start;
  return [start, end];
}

// Whether the 30m office lunch is deducted — on by default for any day with
// an office visit, switched off per day.
export function hasOfficeLunch(day) {
  return !!day && !!day.officeIn && day.officeLunch !== false;
}

export function loggedByCode(day, nowMin) {
  const out = {};
  if (!day || !day.segments) return out;
  for (const seg of day.segments) {
    if (!seg.codeId) continue;
    const b = segmentBounds(seg, nowMin);
    if (!b) continue;
    const min = b[1] - b[0];
    if (min <= 0) continue;
    out[seg.codeId] = (out[seg.codeId] || 0) + min;
  }
  return out;
}

export function sumValues(map) {
  return Object.values(map).reduce((s, v) => s + v, 0);
}

export function loggedMinutes(day, nowMin) {
  return sumValues(loggedByCode(day, nowMin));
}

// `out − in − lunch` (lunch only when toggled on), never negative.
export function officeMinutes(day, { lunchMin = DEFAULT_LUNCH_MIN, nowMin } = {}) {
  const b = officeBounds(day, nowMin);
  if (!b) return 0;
  return Math.max(0, b[1] - b[0] - (hasOfficeLunch(day) ? lunchMin : 0));
}

// Paid = office time + logged work *outside* the office span. A segment that
// straddles arrival/departure only counts its outside part, so nothing is
// double-counted. Leave days pay 0 here — leave is handled by lowering the
// week's bookable hours instead (bank-neutral).
export function paidMinutes(day, { lunchMin = DEFAULT_LUNCH_MIN, nowMin } = {}) {
  if (!day || isLeave(day)) return 0;
  const office = officeBounds(day, nowMin);
  let outside = 0;
  for (const seg of day.segments || []) {
    if (!seg.codeId) continue;
    const b = segmentBounds(seg, nowMin);
    if (!b) continue;
    let len = b[1] - b[0];
    if (office) {
      const overlap = Math.max(0, Math.min(b[1], office[1]) - Math.max(b[0], office[0]));
      len -= overlap;
    }
    outside += Math.max(0, len);
  }
  return officeMinutes(day, { lunchMin, nowMin }) + outside;
}

export function openSegment(day) {
  if (!day || !day.segments || day.segments.length === 0) return null;
  const last = day.segments[day.segments.length - 1];
  return last.end ? null : last;
}

export function isAtOffice(day) {
  return !!day && !!day.officeIn && !day.officeOut;
}

export function hasAnyData(day) {
  return !!day && ((day.segments && day.segments.length > 0) || !!day.officeIn || !!day.officeOut || isLeave(day));
}

// "empty" | "leave" | "open" (today, still running) | "incomplete" (a past
// day left running — forgot to clock out/leave) | "done".
export function dayStatus(day, { isPast, isToday } = {}) {
  if (!hasAnyData(day)) return "empty";
  if (isLeave(day)) return "leave";
  const running = !!openSegment(day) || isAtOffice(day) || (!!day.officeOut && !day.officeIn);
  if (!running) return "done";
  if (isToday) return "open";
  return isPast ? "incomplete" : "open";
}

// "office" | "home" | "office+home" | "leave" | null — how a day row labels
// itself. Mixed = an office visit plus logged work outside its span.
export function dayKind(day, opts = {}) {
  if (!hasAnyData(day)) return null;
  if (isLeave(day)) return "leave";
  if (!day.officeIn) return "home";
  const office = officeMinutes(day, opts);
  const paid = paidMinutes(day, opts);
  return paid > office ? "office+home" : "office";
}
