import { ArrowLeft } from "lucide-react";
import { COLORS } from "../theme/colors.js";

// Fixed top bar shown inside every app (not on the home/launcher screen)
// so there's always a way back out, independent of that app's own sub-nav.
export const TOPBAR_HEIGHT = 44;

export function TopBar({ title, onBack }) {
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        top: 0,
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: "420px",
        height: `${TOPBAR_HEIGHT}px`,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "0 16px",
        background: COLORS.panel,
        borderBottom: `1px solid ${COLORS.border}`,
        zIndex: 40,
      }}
    >
      <button
        onClick={onBack}
        aria-label="back to home"
        style={{ background: "none", border: "none", padding: "6px", margin: "-6px", cursor: "pointer", display: "flex" }}
      >
        <ArrowLeft size={17} color={COLORS.dim} strokeWidth={2} />
      </button>
      <span style={{ fontSize: "12px", color: COLORS.dim, letterSpacing: "0.5px" }}>{title}</span>
    </div>
  );
}
