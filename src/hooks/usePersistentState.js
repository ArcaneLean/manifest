import { useEffect, useState } from "react";

// Generic localStorage-backed state for view settings (sort order, view mode,
// filters, etc.) that should survive a reload but don't belong in IndexedDB
// alongside real data. See useShowCompleted.js for the original single-purpose
// version this generalizes.
export function usePersistentState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage unavailable (private mode, etc.) — setting just won't persist
    }
  }, [key, value]);

  return [value, setValue];
}
