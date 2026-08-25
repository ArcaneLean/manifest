import { useRegisterSW } from "virtual:pwa-register/react";
import { COLORS } from "./theme/colors.js";

// Per ARCHITECTURE.md §2: the service worker detects new deployed assets
// and prompts a refresh — no separate release/versioning step needed.
export function UpdatePrompt() {
  const { needRefresh, updateServiceWorker } = useRegisterSW();
  const [refreshNeeded] = needRefresh;

  if (!refreshNeeded) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: "16px",
        transform: "translateX(-50%)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 14px",
        borderRadius: "8px",
        border: `1px solid ${COLORS.borderBright}`,
        background: COLORS.panel,
        color: COLORS.text,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "12.5px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}
    >
      <span>update available</span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          background: COLORS.amber,
          border: "none",
          color: COLORS.bg,
          fontFamily: "inherit",
          fontSize: "inherit",
          fontWeight: 600,
          padding: "5px 10px",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        reload
      </button>
    </div>
  );
}
