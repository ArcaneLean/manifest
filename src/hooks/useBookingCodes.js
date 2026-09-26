import { useEffect, useState } from "react";
import { listBookingCodes, putBookingCode, deleteBookingCode } from "../lib/bookingCodesRepo.js";

export function useBookingCodes() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listBookingCodes().then((loaded) => {
      if (cancelled) return;
      setCodes(loaded);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addCode = ({ projectId, name, code = "" }) => {
    const row = { id: crypto.randomUUID(), projectId, name, code, archived: false };
    setCodes((prev) => [...prev, row]);
    putBookingCode(row);
    return row;
  };

  const updateCode = (id, patch) => {
    setCodes((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
      const updated = next.find((c) => c.id === id);
      if (updated) putBookingCode(updated);
      return next;
    });
  };

  const removeCode = (id) => {
    setCodes((prev) => prev.filter((c) => c.id !== id));
    deleteBookingCode(id);
  };

  return { codes, loading, addCode, updateCode, removeCode };
}
