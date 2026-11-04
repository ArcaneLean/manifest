import { useEffect, useMemo, useState } from "react";
import { useTasks } from "./useTasks.js";
import { useHabits } from "./useHabits.js";
import { useTemplates } from "./useTemplates.js";
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

// Shortlist is a pure overlay over the task/habit/template stores (see
// ARCHITECTURE.md §7 "Shortlist") — only non-done, already-started tasks,
// all habits and all one-off templates are in scope. Recurring templates
// stay out: their open anchor task is already in scope as a task. A task with a future startDate is out of
// scope entirely (same treatment as a completed task) since it isn't
// actionable yet — see taskDates.js. On every load it self-heals: any
// in-scope item missing from all three buckets is appended to "could"
// (newly created tasks/habits are "imported" this way with no manual
// step), and any id no longer backed by a live in-scope item (task
// completed/deleted/not-yet-started, habit deleted) is dropped.
export function useShortlist() {
  const { tasks, loading: tasksLoading, toggleTask, addTask } = useTasks();
  const { habits, loading: habitsLoading } = useHabits();
  const { templates, loading: templatesLoading } = useTemplates();
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
    templates
      .filter((t) => !t.recurring)
      .forEach((t) => map.set(`template:${t.id}`, { id: `template:${t.id}`, itemType: "template", text: t.text, tags: t.tags || [], template: t }));
    return map;
  }, [tasks, habits, templates, todayISO]);

  const loading = orderLoading || tasksLoading || habitsLoading || templatesLoading;

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

  // Marks a task done in place (habits have no "done" state and are
  // ignored). The task then falls out of scope, so the self-heal effect
  // above drops it from whichever bucket held it on the next render — same
  // as if it had been completed from the Tasks view.
  const completeItem = (id) => {
    if (!id.startsWith("task:")) return;
    toggleTask(id.slice("task:".length));
  };

  // Runs a one-off template: creates a real task from it (same as the
  // Templates view's "run") and slots the new task into the template's own
  // bucket, right after the template — so running a template you've
  // triaged as "want to do" yields a task that's already in "want to do".
  // The template itself stays put; it's reusable.
  const runItem = (id) => {
    const item = items.get(id);
    if (!item || item.itemType !== "template") return;
    const { text, urgent, important, tags: templateTags } = item.template;
    const task = addTask({ text, urgent, important, tags: templateTags });
    const taskId = `task:${task.id}`;
    setOrder((prev) => {
      if (!prev) return prev;
      const bucket = BUCKETS.find((b) => prev[b].includes(id)) || "could";
      const list = prev[bucket].slice();
      list.splice(list.indexOf(id) + 1, 0, taskId);
      const next = { ...prev, [bucket]: list };
      putShortlistOrder(next);
      return next;
    });
  };

  // Bulk version of moveItem: every item currently in `fromBucket` carrying
  // `tagId` steps to `toBucket` together, appended in their existing
  // relative order — the Shortlist's per-tag ✕/✓ buttons (ARCHITECTURE.md
  // §7 "Shortlist"). Habits never match since they carry no tags; templates
  // do.
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

  return { loading, bucketItems, moveItem, completeItem, runItem, moveTag, reorderBucket, reset };
}
