import { useEffect, useState, useCallback } from "react";
import { usePersistentState } from "./usePersistentState.js";
import { getValidDriveToken, revokeDriveAccess, isDriveAuthConfigured } from "../lib/driveAuth.js";
import { pushBackupSnapshot } from "../lib/driveBackup.js";

// Periodic push cadence while the app is open and connected — a personal,
// single-user backup doesn't need to be fresher than this, and it keeps
// background API calls infrequent. See ARCHITECTURE.md §7 ("Drive backup").
const BACKUP_INTERVAL_MS = 15 * 60 * 1000;

// "connected" only records that the user has granted access before — the
// access token itself is never persisted (see driveAuth.js), so on reload
// this drives a silent (non-interactive) token re-request rather than
// re-showing the consent screen, same pattern as useGoogleCalendar.js.
const CONNECTED_KEY = "manifest.drive.connected";
const LAST_BACKUP_KEY = "manifest.drive.lastBackupAt";

export function useDriveBackup() {
  const [connected, setConnected] = usePersistentState(CONNECTED_KEY, false);
  const [lastBackupAt, setLastBackupAt] = usePersistentState(LAST_BACKUP_KEY, null);
  const [status, setStatus] = useState("idle"); // idle | syncing | error
  const [error, setError] = useState(null);

  const backupNow = useCallback(
    async ({ interactive } = {}) => {
      setStatus("syncing");
      setError(null);
      try {
        const token = await getValidDriveToken({ interactive });
        await pushBackupSnapshot(token);
        setLastBackupAt(Date.now());
        setStatus("idle");
        return true;
      } catch (err) {
        setStatus("error");
        setError(err);
        return false;
      }
    },
    [setLastBackupAt]
  );

  // Silent periodic push while connected — mirrors useGoogleCalendar's
  // silent background refresh on load, just repeated on a timer instead of
  // running once.
  useEffect(() => {
    if (!connected) return;
    backupNow({ interactive: false });
    const id = setInterval(() => backupNow({ interactive: false }), BACKUP_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const connect = useCallback(async () => {
    const ok = await backupNow({ interactive: true });
    if (ok) setConnected(true);
    return ok;
  }, [backupNow, setConnected]);

  // Only revokes the OAuth grant and forgets "connected" — the backup file
  // already written to Drive is left in place, same as disconnecting from
  // Google Calendar doesn't delete history that already synced.
  const disconnect = useCallback(() => {
    revokeDriveAccess();
    setConnected(false);
    setStatus("idle");
    setError(null);
  }, [setConnected]);

  return {
    configured: isDriveAuthConfigured(),
    connected,
    status,
    error,
    lastBackupAt,
    connect,
    disconnect,
    backupNow: () => backupNow({ interactive: false }),
  };
}
