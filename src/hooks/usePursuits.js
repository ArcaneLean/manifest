import { useEffect, useState } from "react";
import { listPursuits, putPursuit, deletePursuit } from "../lib/pursuitsRepo.js";
import { newPursuit, moveToStatus, endRank, reorder as reorderRanks } from "../lib/hobbies/model.js";

// Hobbies — see ARCHITECTURE.md §7 ("Hobbies"). Same load-once, optimistic
// state + put shape as useWorkTasks.
export function usePursuits() {
  const [pursuits, setPursuits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listPursuits().then((loaded) => {
      if (cancelled) return;
      setPursuits(loaded);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const write = (records) => {
    if (records.length === 0) return;
    const byId = new Map(records.map((r) => [r.id, r]));
    setPursuits((prev) => prev.map((p) => byId.get(p.id) || p));
    records.forEach(putPursuit);
  };

  // New records go to the end of their list.
  const addPursuit = (fields) => {
    const status = fields.status || "idea";
    const p = newPursuit({ ...fields, status, rank: endRank(pursuits, status) });
    setPursuits((prev) => [...prev, p]);
    putPursuit(p);
    return p;
  };

  // A `status` in `patch` goes through moveToStatus (timestamps + end of
  // the new list). Reads `pursuits`, not the updater's `prev`, so the put
  // runs exactly once — same reason as useWorkTasks.updateTask.
  const updatePursuit = (id, patch) => {
    const current = pursuits.find((p) => p.id === id);
    if (!current) return;
    const { status, ...rest } = patch;
    let updated = { ...current, ...rest };
    if (status) updated = moveToStatus(pursuits, updated, status);
    write([updated]);
  };

  const setStatus = (id, status) => updatePursuit(id, { status });

  const removePursuit = (id) => {
    setPursuits((prev) => prev.filter((p) => p.id !== id));
    deletePursuit(id);
  };

  const reorder = (orderedIds) => write(reorderRanks(pursuits, orderedIds));

  return { pursuits, loading, addPursuit, updatePursuit, setStatus, removePursuit, reorder };
}
