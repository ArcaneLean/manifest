import { useEffect, useMemo, useState } from "react";
import { useTasks } from "./useTasks.js";
import { useHabits } from "./useHabits.js";
import { getShortlistOrder, putShortlistOrder } from "../lib/shortlistRepo.js";
import { isScheduled } from "../lib/taskDates.js";
import { toISO } from "../lib/dateUtils.js";

const BUCKETS = ["wont", "could", "want"];

function withoutId(order, id) {
  return {
    id: order.id,
    wont: order.wont.filter((x) => x !== id),
    could: order.could.filter((x) => x !== id),
    want: order.want.filter((x) => x !== id),
  };
}

// Shortlist is a pure overlay over the task/habit stores (see
// ARCHITECTURE.md §7 "Shortlist") — only non-done, already-started tasks
// and all habits are in scope. A task with a future startDate is out of
// scope entirely (same treatment as a completed task) since it isn't
// actionable yet — see taskDates.js. On every load it self-heals: any
// in-scope item missing from all three buckets is appended to "could"
// (newly created tasks/habits are "imported" this way with no manual
// step), and any id no longer backed by a live in-scope item (task
// completed/deleted/not-yet-started, habit deleted) is dropped.
export function useShortlist() {
  const { tasks, loading: tasksLoading } = useTasks();
  const { habits, loading: habitsLoading } = useHabits();
  const [order, setOrder] = useState(null);
  const [orderLoading, setOrderLoading] = useState(true);
  const todayISO = toISO(new Date());

  useEffect(() => {
    let cancelled = false;
    getShortlistOrder().then((loaded) => {
      if (cancelled) return;
      setOrder(loaded);
      setOrderLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => {
    const map = new Map();
    tasks
      .filter((t) => !t.done && !isScheduled(t, todayISO))
      .forEach((t) => map.set(`task:${t.id}`, { id: `task:${t.id}`, itemType: "task", text: t.text, tags: t.tags || [] }));
    habits.forEach((h) => map.set(`habit:${h.id}`, { id: `habit:${h.id}`, itemType: "habit", text: h.name, tags: [] }));
    return map;
  }, [tasks, habits, todayISO]);

  const loading = orderLoading || tasksLoading || habitsLoading;

  useEffect(() => {
    if (loading || !order) return;
    const known = new Set([...order.wont, ...order.could, ...order.want]);
    const cleaned = {
      id: order.id,
      wont: order.wont.filter((id) => items.has(id)),
      could: order.could.filter((id) => items.has(id)),
      want: order.want.filter((id) => items.has(id)),
    };
    const newIds = [...items.keys()].filter((id) => !known.has(id));
    if (newIds.length > 0) cleaned.could = [...cleaned.could, ...newIds];
    const unchanged = BUCKETS.every((b) => cleaned[b].length === order[b].length && cleaned[b].every((id, i) => id === order[b][i]));
    if (!unchanged) {
      setOrder(cleaned);
      putShortlistOrder(cleaned);
    }
  }, [items, order, loading]);

  const bucketItems = (bucket) => (order ? order[bucket].map((id) => items.get(id)).filter(Boolean) : []);

  // Moves an item one step toward `toBucket`, appended to the end of it.
  const moveItem = (id, toBucket) => {
    setOrder((prev) => {
      if (!prev) return prev;
      const next = withoutId(prev, id);
      next[toBucket] = [...next[toBucket], id];
      putShortlistOrder(next);
      return next;
    });
  };

  // Bulk version of moveItem: every item currently in `fromBucket` carrying
  // `tagId` steps to `toBucket` together, appended in their existing
  // relative order — the Shortlist's per-tag ✕/✓ buttons (ARCHITECTURE.md
  // §7 "Shortlist"). Habits never match since they carry no tags.
  const moveTag = (tagId, fromBucket, toBucket) => {
    setOrder((prev) => {
      if (!prev) return prev;
      const moving = prev[fromBucket].filter((id) => items.get(id)?.tags?.includes(tagId));
      if (moving.length === 0) return prev;
      const movingSet = new Set(moving);
      const next = {
        ...prev,
        [fromBucket]: prev[fromBucket].filter((id) => !movingSet.has(id)),
        [toBucket]: [...prev[toBucket], ...moving],
      };
      putShortlistOrder(next);
      return next;
    });
  };

  // Replaces one bucket's ordering wholesale (manual drag reorder).
  const reorderBucket = (bucket, orderedIds) => {
    setOrder((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [bucket]: orderedIds };
      putShortlistOrder(next);
      return next;
    });
  };

  // Sends everything back to "could" — keeps could's current relative order
  // first, then want, then wont, so items already-sorted-as-could aren't
  // reshuffled by the items coming back in from the other two buckets.
  const reset = () => {
    setOrder((prev) => {
      if (!prev) return prev;
      const next = { id: prev.id, wont: [], could: [...prev.could, ...prev.want, ...prev.wont], want: [] };
      putShortlistOrder(next);
      return next;
    });
  };

  return { loading, bucketItems, moveItem, moveTag, reorderBucket, reset };
}
