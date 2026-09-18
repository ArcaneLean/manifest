import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { COLORS } from "../theme/colors.js";

// Connect/backup-now control for the per-device Drive backup — see
// ARCHITECTURE.md §7 ("Drive backup"). Mirrors GoogleCalendarButton's
// icon-button styling and configured-gate (renders nothing without
// VITE_GOOGLE_CLIENT_ID set).
//
// A plain click connects (first time) or backs up immediately (once
// connected) — there's no visible/hidden state to toggle here like
// Calendar has, since a backup has no content to show or hide. Right-click
// disconnects, same deliberately-harder-to-hit placement as Calendar's
// disconnect, since it revokes the OAuth grant.
export function DriveBackupButton({ configured, connected, status, error, lastBackupAt, onConnect, onBackupNow, onDisconnect }) {
  if (!configured) return null;

  const syncing = status === "syncing";
  const failed = status === "error";

  const lastBackupStr = lastBackupAt ? new Date(lastBackupAt).toLocaleString() : null;

  const title = !connected
    ? "back up to drive (this device only)"
    : syncing
      ? "backing up to drive…"
      : failed
        ? `drive backup failed: ${error?.message || "unknown error"} — right-click to disconnect`
        : `back up now — last backup ${lastBackupStr || "never"} — right-click to disconnect`;

  return (
    <button
      onClick={() => (connected ? onBackupNow() : onConnect())}
      onContextMenu={(e) => {
        e.preventDefault();
        if (connected) onDisconnect();
      }}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "26px",
        height: "26px",
        background: "none",
        border: `1px solid ${COLORS.border}`,
        borderRadius: "6px",
        cursor: "pointer",
      }}
    >
      {syncing ? (
        <RefreshCw size={13} color={COLORS.dim} className="spin" />
      ) : !connected ? (
        <CloudOff size={13} color={COLORS.dim} />
      ) : (
        <Cloud size={13} color={failed ? "#c47b8b" : COLORS.amber} />
      )}
    </button>
  );
}
