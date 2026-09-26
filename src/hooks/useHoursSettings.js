import { useEffect, useState } from "react";
import { getHoursSettings, putHoursSettings } from "../lib/hoursSettingsRepo.js";
import { DEFAULT_SETTINGS } from "../lib/hours2/summary.js";

export function useHoursSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getHoursSettings().then((s) => {
      if (cancelled) return;
      setSettings(s);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = (patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      putHoursSettings(next);
      return next;
    });
  };

  return { settings, loading, updateSettings };
}
