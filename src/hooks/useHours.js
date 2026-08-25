import { useEffect, useState } from "react";
import {
  listWorklog,
  putWorklogEntry,
  deleteWorklogEntry,
  listWeekTargets,
  putWeekTarget,
} from "../lib/hoursRepo.js";

export function useHours() {
  const [worklog, setWorklog] = useState({});
  const [weekTargets, setWeekTargets] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listWorklog(), listWeekTargets()]).then(([entries, targets]) => {
      if (cancelled) return;
      const worklogByDate = Object.fromEntries(entries.map((e) => [e.date, e]));
      const targetsByWeek = Object.fromEntries(targets.map((t) => [t.weekStartISO, t.targetHours]));
      setWorklog(worklogByDate);
      setWeekTargets(targetsByWeek);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveEntry = (date, { start, end, breakMin }) => {
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

  const saveWeekTarget = (weekStartISO, targetHours) => {
    setWeekTargets((prev) => ({ ...prev, [weekStartISO]: targetHours }));
    putWeekTarget({ weekStartISO, targetHours });
  };

  return { worklog, weekTargets, loading, saveEntry, clearEntry, saveWeekTarget };
}
