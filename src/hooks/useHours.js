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

  // end is null while clocked in (start logged, day not over yet).
  const saveEntry = (date, { start, end = null, breakMin = 0 }) => {
    const entry = { date, start, end, breakMin };
    setWorklog((prev) => ({ ...prev, [date]: entry }));
    putWorklogEntry(entry);
  };

  const clearEntry = (date) => {
    setWorklog((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
    deleteWorklogEntry(date);
  };

  return { worklog, loading, saveEntry, clearEntry, normalDayHours, setNormalDayHours };
}
