import { useEffect, useState } from "react";
import { listWorklog, putWorklogEntry, deleteWorklogEntry } from "../lib/hoursRepo.js";
import { hasAnyData, openSegment } from "../lib/hours2/day.js";

// Hours 2.0 worklog — one WorkDay per date (see ARCHITECTURE.md §7 "Hours
// 2.0"): an optional office visit (officeIn/officeOut/officeLunch), an
// optional dayOff, and code-tagged segments (codeId null = break).
export function useHours() {
  const [worklog, setWorklog] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listWorklog().then((entries) => {
      if (cancelled) return;
      setWorklog(Object.fromEntries(entries.map((e) => [e.date, e])));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Applies `fn` to a day (a fresh empty one if it doesn't exist yet) and
  // persists the result — or deletes the row once nothing is left on it.
  // The put runs inside the updater so it always sees the latest state; it's
  // idempotent, so a double-invoked updater (Strict Mode) is harmless.
  const updateDay = (date, fn) => {
    setWorklog((prev) => {
      const current = prev[date] || { date, segments: [] };
      const next = { ...fn(current), date };
      const out = { ...prev };
      if (hasAnyData(next)) {
        out[date] = next;
        putWorklogEntry(next);
      } else {
        delete out[date];
        deleteWorklogEntry(date);
      }
      return out;
    });
  };

  const saveDay = (day) => updateDay(day.date, () => day);
  const clearDay = (date) => updateDay(date, () => ({ date, segments: [] }));

  const closeOpen = (segments, time) => {
    const open = segments.length && !segments[segments.length - 1].end;
    return open ? [...segments.slice(0, -1), { ...segments[segments.length - 1], end: time }] : segments;
  };

  // Starts logging (also resumes after clocking out, e.g. an evening at
  // home after an office day): appends an open segment on `codeId`.
  const clockIn = (date, time, codeId) =>
    updateDay(date, (d) => ({ ...d, segments: [...closeOpen(d.segments || [], time), { start: time, end: null, codeId }] }));

  // Closes the open segment and opens one on a different code/break.
  const switchSegment = clockIn;

  const clockOut = (date, time) =>
    updateDay(date, (d) => (openSegment(d) ? { ...d, segments: closeOpen(d.segments, time) } : d));

  // Office arrival/departure — separate from logging: paid from arrival even
  // if the first log starts later.
  const arrive = (date, time) => updateDay(date, (d) => ({ ...d, officeIn: time, officeOut: d.officeOut || null }));
  const leave = (date, time) => updateDay(date, (d) => ({ ...d, officeOut: time }));

  return { worklog, loading, updateDay, saveDay, clearDay, clockIn, switchSegment, clockOut, arrive, leave };
}
