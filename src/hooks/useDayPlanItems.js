import { useEffect, useState } from "react";
import { listDayPlanItems, putDayPlanItems, deleteDayPlanItems } from "../lib/dayPlanItemsRepo.js";

const EMPTY = { habitIds: [], taskIds: [], itemOrder: [] };

// Synthesizes `itemOrder` (a combined, interleavable {type, id} sequence)
// for rows persisted before it existed — habits first then tasks,
// preserving each list's own prior order, so no stored plan silently
// reshuffles the first time it's loaded under the new model.
function withItemOrder(row) {
  const habitIds = row.habitIds || [];
  const taskIds = row.taskIds || [];
  const itemOrder = row.itemOrder || [...habitIds.map((id) => ({ type: "habit", id })), ...taskIds.map((id) => ({ type: "task", id }))];
  return { habitIds, taskIds, itemOrder };
}

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
      setByDate(Object.fromEntries(rows.map((r) => [r.date, withItemOrder(r)])));
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
    updateDate(dateISO, (cur) =>
      cur.habitIds.includes(habitId)
        ? cur
        : { ...cur, habitIds: [...cur.habitIds, habitId], itemOrder: [...cur.itemOrder, { type: "habit", id: habitId }] }
    );

  const unplanHabit = (dateISO, habitId) =>
    updateDate(dateISO, (cur) => ({
      ...cur,
      habitIds: cur.habitIds.filter((id) => id !== habitId),
      itemOrder: cur.itemOrder.filter((e) => !(e.type === "habit" && e.id === habitId)),
    }));

  const planTask = (dateISO, taskId) =>
    updateDate(dateISO, (cur) =>
      cur.taskIds.includes(taskId)
        ? cur
        : { ...cur, taskIds: [...cur.taskIds, taskId], itemOrder: [...cur.itemOrder, { type: "task", id: taskId }] }
    );

  const unplanTask = (dateISO, taskId) =>
    updateDate(dateISO, (cur) => ({
      ...cur,
      taskIds: cur.taskIds.filter((id) => id !== taskId),
      itemOrder: cur.itemOrder.filter((e) => !(e.type === "task" && e.id === taskId)),
    }));

  // `itemOrder` is a single combined sequence spanning both habits and
  // tasks — swapping adjacent entries here (regardless of type) is what
  // lets the Day Planner timeline's up/down controls move a habit past a
  // task or vice versa, rather than reordering within separate per-type
  // lists (see buildDayPlan, which schedules items in this same order).
  const moveItem = (dateISO, type, id, dir) =>
    updateDate(dateISO, (cur) => {
      const order = [...cur.itemOrder];
      const i = order.findIndex((e) => e.type === type && e.id === id);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= order.length) return cur;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...cur, itemOrder: order };
    });

  return { plannedForDate, planHabit, unplanHabit, planTask, unplanTask, moveItem, loading };
}
