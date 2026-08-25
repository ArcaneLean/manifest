import { useEffect, useState } from "react";

// Reused across every prototype view for the header date/time readout.
export function useClock(intervalMs = 60000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
