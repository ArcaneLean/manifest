import { useEffect, useState } from "react";
import { listCountdowns, putCountdown, deleteCountdown } from "../lib/countdownsRepo.js";

export function useCountdowns() {
  const [countdowns, setCountdowns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listCountdowns().then((loaded) => {
      if (!cancelled) {
        setCountdowns(loaded);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addCountdown = ({ label, date }) => {
    const countdown = { id: crypto.randomUUID(), label, date };
    setCountdowns((prev) => [...prev, countdown]);
    putCountdown(countdown);
  };

  const removeCountdown = (id) => {
    setCountdowns((prev) => prev.filter((c) => c.id !== id));
    deleteCountdown(id);
  };

  return { countdowns, loading, addCountdown, removeCountdown };
}
