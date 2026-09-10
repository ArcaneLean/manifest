import { COLORS } from "../theme/colors.js";

// Small generic yes/no confirmation, same bottom-sheet-over-scrim treatment
// as HabitDetailModal, for actions worth a pause before committing (e.g.
// Shortlist's Reset, which touches every item at once).
export function ConfirmDialog({ title, message, confirmLabel = "confirm", onConfirm, onCancel }) {
  return (
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "calc(100% - 40px)",
          maxWidth: "360px",
          background: COLORS.panel,
          border: `1px solid ${COLORS.borderBright}`,
          borderRadius: "10px",
          padding: "18px 20px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: "14.5px", color: COLORS.text, fontWeight: 600, marginBottom: "8px" }}>{title}</div>
        <div style={{ fontSize: "12.5px", color: COLORS.dim, marginBottom: "18px", lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: `1px solid ${COLORS.border}`,
              color: COLORS.dim,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12.5px",
              padding: "8px 14px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: COLORS.amber,
              border: "none",
              color: COLORS.bg,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12.5px",
              fontWeight: 600,
              padding: "8px 14px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
