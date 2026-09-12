import { useEffect, useState } from "react";
import { listWorklog, putWorklogEntry, deleteWorklogEntry } from "../lib/hoursRepo.js";
import { usePersistentState } from "./usePersistentState.js";

const NORMAL_DAY_HOURS_KEY = "manifest.hours.normalDayHours";
const DEFAULT_NORMAL_DAY_HOURS = 8.5;

export function useHours() {
  const [worklog, setWorklog] = useState({});
  const [loading, setLoading] = useState(true);
  const [normalDayHours, setNormalDayHours] = usePersistentState(NORMAL_DAY_HOURS_KEY, DEFAULT_NORMAL_DAY_HOURS);

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

  // Full replace of a day's segment list — used directly by the backfill/edit
  // panel, and as the shared primitive the clock in/switch/out actions below
  // build on.
  const saveEntry = (date, segments) => {
    const entry = { date, segments };
    setWorklog((prev) => ({ ...prev, [date]: entry }));
    putWorklogEntry(entry);
    return entry;
  };

  const clearEntry = (date) => {
    setWorklog((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
    deleteWorklogEntry(date);
  };

  // Starts the day: one open segment (start logged, end null) on the given
  // project (or null for break).
  const clockIn = (date, time, projectId) => saveEntry(date, [{ start: time, end: null, projectId }]);

  // Closes the current open segment and opens a new one on a different
  // project/break — used both for "switch project" and "take a break".
  const switchSegment = (date, time, projectId) => {
    const entry = worklog[date];
    const prior = entry ? entry.segments.slice(0, -1) : [];
    const current = entry ? entry.segments[entry.segments.length - 1] : null;
    const closed = current ? [{ ...current, end: time }] : [];
    saveEntry(date, [...prior, ...closed, { start: time, end: null, projectId }]);
  };

  // Ends the day: closes the current open segment, no new one follows.
  const clockOut = (date, time) => {
    const entry = worklog[date];
    if (!entry || entry.segments.length === 0) return;
    const prior = entry.segments.slice(0, -1);
    const current = entry.segments[entry.segments.length - 1];
    saveEntry(date, [...prior, { ...current, end: time }]);
  };

  return { worklog, loading, saveEntry, clearEntry, clockIn, switchSegment, clockOut, normalDayHours, setNormalDayHours };
}
