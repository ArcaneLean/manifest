import { useEffect, useState } from "react";
import {
  listDayShapes,
  putDayShape,
  deleteDayShape,
  listDayOverrides,
  putDayOverride,
  deleteDayOverride,
} from "../lib/dayShapesRepo.js";
import { DAY_START_MIN } from "../lib/dayPlan.js";

const EMPTY_OVERRIDE = { dayShapeId: null, wakeMinutes: null, extraBlocks: [] };

function isOverrideEmpty(o) {
  return !o || (!o.dayShapeId && o.wakeMinutes == null && (!o.extraBlocks || o.extraBlocks.length === 0));
}

export function useDayShapes() {
  const [dayShapes, setDayShapes] = useState([]);
  // date -> { dayShapeId, wakeMinutes, extraBlocks } — see ARCHITECTURE.md §7.
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listDayShapes(), listDayOverrides()]).then(([shapes, loadedOverrides]) => {
      if (cancelled) return;
      setDayShapes(shapes);
      setOverrides(
        Object.fromEntries(
          loadedOverrides.map((o) => [
            o.date,
            { dayShapeId: o.dayShapeId ?? null, wakeMinutes: o.wakeMinutes ?? null, extraBlocks: o.extraBlocks || [] },
          ])
        )
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addDayShape = ({ name }) => {
    const shape = { id: crypto.randomUUID(), name, blocks: [], weekdays: [], wakeMinutes: DAY_START_MIN };
    setDayShapes((prev) => [...prev, shape]);
    putDayShape(shape);
    return shape;
  };

  const updateDayShape = (id, patch) => {
    setDayShapes((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      const updated = next.find((s) => s.id === id);
      if (updated) putDayShape(updated);
      return next;
    });
  };

  const removeDayShape = (id) => {
    setDayShapes((prev) => prev.filter((s) => s.id !== id));
    deleteDayShape(id);
    setOverrides((prev) => {
      const next = {};
      let changed = false;
      for (const [date, override] of Object.entries(prev)) {
        if (override.dayShapeId === id) {
          const cleared = { ...override, dayShapeId: null };
          changed = true;
          if (isOverrideEmpty(cleared)) deleteDayOverride(date);
          else {
            putDayOverride({ date, ...cleared });
            next[date] = cleared;
          }
        } else {
          next[date] = override;
        }
      }
      return changed ? next : prev;
    });
  };

  const persistOverride = (dateISO, next) => {
    setOverrides((prev) => ({ ...prev, [dateISO]: next }));
    if (isOverrideEmpty(next)) deleteDayOverride(dateISO);
    else putDayOverride({ date: dateISO, ...next });
  };

  // dayShapeId === null clears the override, falling back to the weekday default.
  const setOverrideForDate = (dateISO, dayShapeId) => {
    const current = overrides[dateISO] || EMPTY_OVERRIDE;
    persistOverride(dateISO, { ...current, dayShapeId: dayShapeId || null });
  };

  // wakeMinutes === null clears the override, falling back to the shape's
  // (or global default) wake time.
  const setWakeOverrideForDate = (dateISO, wakeMinutes) => {
    const current = overrides[dateISO] || EMPTY_OVERRIDE;
    persistOverride(dateISO, { ...current, wakeMinutes: wakeMinutes ?? null });
  };

  // Ad hoc blocks that exist only for one specific date (e.g. "commute to
  // the airport") — never promoted into a DayShape template.
  const addExtraBlockForDate = (dateISO, block) => {
    const current = overrides[dateISO] || EMPTY_OVERRIDE;
    const extraBlocks = [...current.extraBlocks, { id: crypto.randomUUID(), anchor: "chained", ...block }];
    persistOverride(dateISO, { ...current, extraBlocks });
  };

  const updateExtraBlockForDate = (dateISO, blockId, patch) => {
    const current = overrides[dateISO] || EMPTY_OVERRIDE;
    const extraBlocks = current.extraBlocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b));
    persistOverride(dateISO, { ...current, extraBlocks });
  };

  const removeExtraBlockForDate = (dateISO, blockId) => {
    const current = overrides[dateISO] || EMPTY_OVERRIDE;
    const extraBlocks = current.extraBlocks.filter((b) => b.id !== blockId);
    persistOverride(dateISO, { ...current, extraBlocks });
  };

  // 0=Mon..6=Sun, matching Template.recurring.days' convention.
  const dayShapeForDate = (dateISO, weekday) => {
    const overrideId = overrides[dateISO]?.dayShapeId;
    if (overrideId) return dayShapes.find((s) => s.id === overrideId) || null;
    return dayShapes.find((s) => s.weekdays?.includes(weekday)) || null;
  };

  // Resolution order: a one-off override for this exact date, else the
  // shape's own default, else the global fallback constant.
  const wakeMinutesForDate = (dateISO, shape) => {
    const override = overrides[dateISO]?.wakeMinutes;
    if (override != null) return override;
    return shape?.wakeMinutes ?? DAY_START_MIN;
  };

  const extraBlocksForDate = (dateISO) => overrides[dateISO]?.extraBlocks || [];

  return {
    dayShapes,
    overrides,
    loading,
    addDayShape,
    updateDayShape,
    removeDayShape,
    setOverrideForDate,
    setWakeOverrideForDate,
    addExtraBlockForDate,
    updateExtraBlockForDate,
    removeExtraBlockForDate,
    dayShapeForDate,
    wakeMinutesForDate,
    extraBlocksForDate,
  };
}
