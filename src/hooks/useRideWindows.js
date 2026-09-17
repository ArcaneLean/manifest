import { useEffect, useState } from "react";
import { listRideWindows, putRideWindow, deleteRideWindow } from "../lib/rideWindowsRepo.js";

export function useRideWindows() {
  const [rideWindows, setRideWindows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listRideWindows().then((loaded) => {
      if (!cancelled) {
        setRideWindows(loaded);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addRideWindow = (fields) => {
    const rideWindow = { id: crypto.randomUUID(), ...fields };
    setRideWindows((prev) => [...prev, rideWindow]);
    putRideWindow(rideWindow);
    return rideWindow;
  };

  const updateRideWindow = (id, fields) => {
    setRideWindows((prev) => {
      const next = prev.map((w) => (w.id === id ? { ...w, ...fields } : w));
      const updated = next.find((w) => w.id === id);
      if (updated) putRideWindow(updated);
      return next;
    });
  };

  const removeRideWindow = (id) => {
    setRideWindows((prev) => prev.filter((w) => w.id !== id));
    deleteRideWindow(id);
  };

  return { rideWindows, loading, addRideWindow, updateRideWindow, removeRideWindow };
}
