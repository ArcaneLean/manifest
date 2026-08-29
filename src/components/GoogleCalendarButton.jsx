import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { COLORS } from "../theme/colors.js";

// Connect/disconnect control for the optional read-only Google Calendar
// sync — see ARCHITECTURE.md §7 ("Google Calendar integration"). Mirrors
// CompletedToggle's icon-button styling. Renders nothing if no OAuth client
// ID is configured (VITE_GOOGLE_CLIENT_ID), so the feature is invisible
// until someone sets it up.
export function GoogleCalendarButton({ configured, connected, status, error, onConnect, onDisconnect }) {
  if (!configured) return null;

  const syncing = status === "syncing";
  const failed = status === "error";

  const title = !connected
    ? "connect google calendar (read-only)"
    : syncing
      ? "syncing google calendar…"
      : failed
        ? `google calendar sync failed: ${error?.message || "unknown error"} — click to disconnect`
        : "google calendar connected — click to disconnect";

  return (
    <button
      onClick={() => (connected ? onDisconnect() : onConnect())}
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
      ) : connected ? (
        <Cloud size={13} color={failed ? "#c47b8b" : COLORS.amber} />
      ) : (
        <CloudOff size={13} color={COLORS.dim} />
      )}
    </button>
  );
}
