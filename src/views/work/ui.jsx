// Building blocks for the Work tasks views — see ARCHITECTURE.md §7 ("Work
// tasks"). Page/Header/Section etc. come from Hours' UI kit (same look, and
// Work shows Hours booking codes anyway); only what's Work-specific is here.
import { Plus, X } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { NAV_HEIGHT } from "../../components/NavBar.jsx";
import { MONO } from "../hours/ui.jsx";

export const fieldStyle = {
  width: "100%",
  background: "transparent",
  border: `1px solid ${COLORS.border}`,
  borderRadius: "6px",
  outline: "none",
  color: COLORS.text,
  caretColor: COLORS.amber,
  fontFamily: MONO,
  fontSize: "12.5px",
  padding: "8px 10px",
  boxSizing: "border-box",
  colorScheme: "dark",
};

export const fieldLabelStyle = { fontSize: "10.5px", color: COLORS.dim, letterSpacing: "0.5px", marginBottom: "6px" };

export function Fab({ onClick, label }) {
  return (
    <button
      className="fab"
      onClick={onClick}
      aria-label={label}
      style={{
        position: "fixed",
        bottom: `${28 + NAV_HEIGHT}px`,
        right: "max(20px, calc(50% - 210px + 20px))",
        width: "52px",
        height: "52px",
        borderRadius: "8px",
        background: COLORS.amber,
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 0 20px rgba(255,176,0,0.35), 0 4px 12px rgba(0,0,0,0.5)`,
        cursor: "pointer",
        zIndex: 30,
      }}
    >
      <Plus size={24} color={COLORS.bg} strokeWidth={2.5} />
    </button>
  );
}

// Bottom sheet over a scrim — same treatment as TaskEditModal, but scrolls
// since the work task form is taller than a phone screen.
export function Sheet({ title, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "420px",
          maxHeight: "92vh",
          overflowY: "auto",
          background: COLORS.panel,
          border: `1px solid ${COLORS.borderBright}`,
          borderBottom: "none",
          borderTopLeftRadius: "10px",
          borderTopRightRadius: "10px",
          padding: "18px 20px 22px",
          boxSizing: "border-box",
          fontFamily: MONO,
          color: COLORS.text,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <span style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", textTransform: "uppercase" }}>{title}</span>
          <span onClick={onClose} style={{ cursor: "pointer" }} aria-label="close">
            <X size={16} color={COLORS.dim} />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: "14px", ...style }}>
      {label && <div style={fieldLabelStyle}>{label}</div>}
      {children}
    </div>
  );
}

// `[005]` zero-padded counter (ARCHITECTURE.md §3).
export function counter(n) {
  return `[${String(Math.min(n, 999)).padStart(3, "0")}]`;
}
