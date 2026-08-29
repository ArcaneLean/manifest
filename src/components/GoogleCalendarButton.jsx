import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { COLORS } from "../theme/colors.js";

// Connect/show-hide control for the optional read-only Google Calendar sync
// — see ARCHITECTURE.md §7 ("Google Calendar integration"). Mirrors
// CompletedToggle's icon-button styling. Renders nothing if no OAuth client
// ID is configured (VITE_GOOGLE_CLIENT_ID), so the feature is invisible
// until someone sets it up.
//
// A plain click never touches the sync or cache: once connected it only
// toggles whether the already-cached events are shown. Actually
// disconnecting (revoking access and dropping the cache, which requires
// interactive re-auth to undo) is a deliberately separate, harder-to-hit
// action — right-click — so it doesn't happen by accident.
export function GoogleCalendarButton({ configured, connected, visible, status, error, onConnect, onToggleVisible, onDisconnect }) {
  if (!configured) return null;

  const syncing = status === "syncing";
  const failed = status === "error";

  const title = !connected
    ? "connect google calendar (read-only)"
    : syncing
      ? "syncing google calendar…"
      : failed
        ? `google calendar sync failed: ${error?.message || "unknown error"} — right-click to disconnect`
        : visible
          ? "google calendar shown — click to hide, right-click to disconnect"
          : "google calendar hidden — click to show, right-click to disconnect";

  return (
    <button
      onClick={() => (connected ? onToggleVisible() : onConnect())}
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
        <Cloud size={13} color={!visible ? COLORS.dim : failed ? "#c47b8b" : COLORS.amber} />
      )}
    </button>
  );
}
