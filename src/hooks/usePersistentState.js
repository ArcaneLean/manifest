import { useEffect, useState } from "react";
import { storageKey } from "../lib/channel.js";

// Generic localStorage-backed state for view settings (sort order, view mode,
// filters, etc.) that should survive a reload but don't belong in IndexedDB
// alongside real data. See useShowCompleted.js for the original single-purpose
// version this generalizes. Keys are namespaced per PR preview (channel.js),
// so a preview's prefs never leak into the real app.
export function usePersistentState(rawKey, defaultValue) {
  const key = storageKey(rawKey);
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
