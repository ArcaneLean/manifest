import { useCallback, useEffect, useState } from "react";
import { listCalendarSettings, putCalendarSettings } from "../lib/calendarSettingsRepo.js";

// Deliberately outside both the quadrant palette and TAG_PALETTE (see
// ARCHITECTURE.md §3) — the color a not-yet-synced Google Calendar event
// falls back to before its calendarSettings row exists.
const FALLBACK_COLOR = "#6b8fb5";

// Per-calendar color + hidden prefs, backed by the calendarSettings store —
// see calendarSettingsRepo.js. Rows are created/pruned by
// googleCalendarSync.js as calendars are discovered/removed on the account;
// this hook only edits color/hidden on existing rows, so `reload()` should
// be called after a sync to pick up newly-synced calendars.
export function useCalendarSettings() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setSettings(await listCalendarSettings());
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const patch = useCallback((calendarId, fields) => {
    setSettings((prev) => {
      const current = prev.find((s) => s.calendarId === calendarId);
      if (!current) return prev;
      const next = { ...current, ...fields };
      putCalendarSettings(next);
      return prev.map((s) => (s.calendarId === calendarId ? next : s));
    });
  }, []);

  const setColor = useCallback((calendarId, color) => patch(calendarId, { color }), [patch]);
  const setHidden = useCallback((calendarId, hidden) => patch(calendarId, { hidden }), [patch]);

  const colorFor = (calendarId) => settings.find((s) => s.calendarId === calendarId)?.color || FALLBACK_COLOR;
  const isHidden = (calendarId) => settings.find((s) => s.calendarId === calendarId)?.hidden || false;

  return { settings, loading, reload, setColor, setHidden, colorFor, isHidden };
}
