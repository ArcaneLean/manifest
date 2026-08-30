import { useEffect, useState } from "react";
import {
  listDayShapes,
  putDayShape,
  deleteDayShape,
  listDayOverrides,
  putDayOverride,
  deleteDayOverride,
} from "../lib/dayShapesRepo.js";

export function useDayShapes() {
  const [dayShapes, setDayShapes] = useState([]);
  const [overrides, setOverrides] = useState({}); // date -> dayShapeId
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listDayShapes(), listDayOverrides()]).then(([shapes, loadedOverrides]) => {
      if (cancelled) return;
      setDayShapes(shapes);
      setOverrides(Object.fromEntries(loadedOverrides.map((o) => [o.date, o.dayShapeId])));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addDayShape = ({ name }) => {
    const shape = { id: crypto.randomUUID(), name, blocks: [], weekdays: [] };
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
      for (const [date, shapeId] of Object.entries(prev)) {
        if (shapeId === id) {
          deleteDayOverride(date);
          changed = true;
        } else {
          next[date] = shapeId;
        }
      }
      return changed ? next : prev;
    });
  };

  // dayShapeId === null clears the override, falling back to the weekday default.
  const setOverrideForDate = (dateISO, dayShapeId) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (dayShapeId) next[dateISO] = dayShapeId;
      else delete next[dateISO];
      return next;
    });
    if (dayShapeId) putDayOverride({ date: dateISO, dayShapeId });
    else deleteDayOverride(dateISO);
  };

  // 0=Mon..6=Sun, matching Template.recurring.days' convention.
  const dayShapeForDate = (dateISO, weekday) => {
    const overrideId = overrides[dateISO];
    if (overrideId) return dayShapes.find((s) => s.id === overrideId) || null;
    return dayShapes.find((s) => s.weekdays?.includes(weekday)) || null;
  };

  return {
    dayShapes,
    overrides,
    loading,
    addDayShape,
    updateDayShape,
    removeDayShape,
    setOverrideForDate,
    dayShapeForDate,
  };
}
