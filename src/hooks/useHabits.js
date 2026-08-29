import { useEffect, useState } from "react";
import {
  listHabits,
  putHabit,
  deleteHabit,
  listHabitEntries,
  putHabitEntry,
  deleteHabitEntry,
  deleteHabitEntriesFor,
} from "../lib/habitsRepo.js";

export function useHabits() {
  const [habits, setHabits] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listHabits(), listHabitEntries()]).then(([loadedHabits, loadedEntries]) => {
      if (cancelled) return;
      setHabits(loadedHabits);
      setEntries(loadedEntries);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addHabit = ({ name, type }) => {
    const habit = { id: crypto.randomUUID(), name, type, createdAt: Date.now() };
    setHabits((prev) => [...prev, habit]);
    putHabit(habit);
    return habit;
  };

  const updateHabit = (id, patch) => {
    setHabits((prev) => {
      const next = prev.map((h) => (h.id === id ? { ...h, ...patch } : h));
      const updated = next.find((h) => h.id === id);
      if (updated) putHabit(updated);
      return next;
    });
  };

  const removeHabit = (id) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setEntries((prev) => {
      const forHabit = prev.filter((e) => e.habitId === id);
      deleteHabitEntriesFor(id, forHabit);
      return prev.filter((e) => e.habitId !== id);
    });
    deleteHabit(id);
  };

  // ts defaults to now (quick-log); pass an explicit epoch ms to backfill a
  // past occurrence.
  const logEntry = (habitId, ts = Date.now()) => {
    const entry = { id: crypto.randomUUID(), habitId, ts };
    setEntries((prev) => [...prev, entry]);
    putHabitEntry(entry);
    return entry;
  };

  const removeEntry = (id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    deleteHabitEntry(id);
  };

  return { habits, entries, loading, addHabit, updateHabit, removeHabit, logEntry, removeEntry };
}
