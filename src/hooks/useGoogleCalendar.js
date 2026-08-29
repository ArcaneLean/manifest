import { useEffect, useState, useCallback } from "react";
import { usePersistentState } from "./usePersistentState.js";
import { listGCalEvents, clearGCalEvents, clearGCalMeta } from "../lib/gcalRepo.js";
import { getValidAccessToken, revokeGoogleAccess, isGoogleAuthConfigured } from "../lib/googleAuth.js";
import { syncGoogleCalendar } from "../lib/googleCalendarSync.js";

// "connected" only records that the user has granted access before — the
// access token itself is never persisted (see googleAuth.js), so on reload
// this drives a silent (non-interactive) token re-request rather than
// re-showing the consent screen. See ARCHITECTURE.md §7 ("Google Calendar
// integration").
const CONNECTED_KEY = "manifest.gcal.connected";

export function useGoogleCalendar() {
  const [connected, setConnected] = usePersistentState(CONNECTED_KEY, false);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | syncing | error
  const [error, setError] = useState(null);

  const reloadCached = useCallback(async () => {
    setEvents(await listGCalEvents());
  }, []);

  useEffect(() => {
    reloadCached();
  }, [reloadCached]);

  const sync = useCallback(
    async ({ interactive }) => {
      setStatus("syncing");
      setError(null);
      try {
        const token = await getValidAccessToken({ interactive });
        await syncGoogleCalendar(token);
        await reloadCached();
        setStatus("idle");
        return true;
      } catch (err) {
        setStatus("error");
        setError(err);
        return false;
      }
    },
    [reloadCached]
  );

  // Background refresh on load for a previously-connected account — silent,
  // so it never interrupts with a popup if the Google session has expired;
  // the user just falls back to cached events until they reconnect.
  useEffect(() => {
    if (connected) sync({ interactive: false });
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = useCallback(async () => {
    const ok = await sync({ interactive: true });
    if (ok) setConnected(true);
    return ok;
  }, [sync, setConnected]);

  const disconnect = useCallback(async () => {
    revokeGoogleAccess();
    await clearGCalEvents();
    await clearGCalMeta();
    setConnected(false);
    setEvents([]);
    setStatus("idle");
    setError(null);
  }, [setConnected]);

  return {
    configured: isGoogleAuthConfigured(),
    connected,
    events,
    status,
    error,
    connect,
    disconnect,
    refresh: () => sync({ interactive: false }),
  };
}
