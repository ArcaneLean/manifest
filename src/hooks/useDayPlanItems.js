import { useEffect, useState } from "react";
import { listDayPlanItems, putDayPlanItems, deleteDayPlanItems } from "../lib/dayPlanItemsRepo.js";

const EMPTY = { habitIds: [], taskIds: [] };

// Explicit per-date "planned for today" lists for habits and tasks — see
// ARCHITECTURE.md §7 ("Day Planner: planning is opt-in"). Kept as its own
// store rather than fields on Habit/Task: adding a task here never touches
// its startDate/dueDate, and habits carry no schedule of their own, so
// nothing shows on a day's plan unless it's explicitly added here.
export function useDayPlanItems() {
  const [byDate, setByDate] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listDayPlanItems().then((rows) => {
      if (cancelled) return;
      setByDate(Object.fromEntries(rows.map((r) => [r.date, { habitIds: r.habitIds || [], taskIds: r.taskIds || [] }])));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const plannedForDate = (dateISO) => byDate[dateISO] || EMPTY;

  const updateDate = (dateISO, updater) => {
    setByDate((prev) => {
      const current = prev[dateISO] || EMPTY;
      const next = updater(current);
      if (next.habitIds.length === 0 && next.taskIds.length === 0) deleteDayPlanItems(dateISO);
      else putDayPlanItems({ date: dateISO, ...next });
      return { ...prev, [dateISO]: next };
    });
  };

  const planHabit = (dateISO, habitId) =>
    updateDate(dateISO, (cur) => (cur.habitIds.includes(habitId) ? cur : { ...cur, habitIds: [...cur.habitIds, habitId] }));

  const unplanHabit = (dateISO, habitId) =>
    updateDate(dateISO, (cur) => ({ ...cur, habitIds: cur.habitIds.filter((id) => id !== habitId) }));

  const planTask = (dateISO, taskId) =>
    updateDate(dateISO, (cur) => (cur.taskIds.includes(taskId) ? cur : { ...cur, taskIds: [...cur.taskIds, taskId] }));

  const unplanTask = (dateISO, taskId) =>
    updateDate(dateISO, (cur) => ({ ...cur, taskIds: cur.taskIds.filter((id) => id !== taskId) }));

  // Array position in `habitIds`/`taskIds` doubles as each list's manual
  // schedule order (see buildDayPlan) — swapping adjacent entries, same
  // pattern as DayShapeEditModal's moveBlock, is enough to make the Day
  // Planner timeline's up/down controls a real (persisted) reorder.
  const moveHabit = (dateISO, habitId, dir) =>
    updateDate(dateISO, (cur) => {
      const ids = [...cur.habitIds];
      const i = ids.indexOf(habitId);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= ids.length) return cur;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      return { ...cur, habitIds: ids };
    });

  const moveTask = (dateISO, taskId, dir) =>
    updateDate(dateISO, (cur) => {
      const ids = [...cur.taskIds];
      const i = ids.indexOf(taskId);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= ids.length) return cur;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      return { ...cur, taskIds: ids };
    });

  return { plannedForDate, planHabit, unplanHabit, planTask, unplanTask, moveHabit, moveTask, loading };
}
