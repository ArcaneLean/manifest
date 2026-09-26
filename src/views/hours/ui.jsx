// Shared building blocks for the Hours 2.0 views — see ARCHITECTURE.md §7
// ("Hours 2.0"). Same "Terminal Log" look as the rest of the app (§3).
import { COLORS } from "../../theme/colors.js";
import { TOPBAR_HEIGHT } from "../../components/TopBar.jsx";
import { NAV_HEIGHT } from "../../components/NavBar.jsx";
import { formatMinutes, formatSignedMinutes } from "../../lib/timeUtils.js";

export const MONO = "'IBM Plex Mono', monospace";

export const timeInputStyle = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: "5px",
  padding: "6px 8px",
  fontSize: "13px",
  background: "transparent",
  color: COLORS.text,
  fontFamily: MONO,
  caretColor: COLORS.amber,
  colorScheme: "dark",
  accentColor: COLORS.amber,
};

export const primaryBtnStyle = {
  background: COLORS.amber,
  border: "none",
  color: COLORS.bg,
  fontFamily: MONO,
  fontSize: "12px",
  fontWeight: 600,
  padding: "7px 12px",
  borderRadius: "6px",
  cursor: "pointer",
};

export const secondaryBtnStyle = {
  background: "none",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.dim,
  fontFamily: MONO,
  fontSize: "12px",
  padding: "7px 12px",
  borderRadius: "6px",
  cursor: "pointer",
};

export const linkStyle = { fontSize: "11.5px", color: COLORS.dim, cursor: "pointer", borderBottom: `1px dashed ${COLORS.border}` };

export function disabledStyle(style, disabled) {
  return disabled ? { ...style, opacity: 0.5, cursor: "default" } : style;
}

export function fmt(min) {
  return formatMinutes(Math.max(0, Math.round(min)));
}

export function fmtSigned(min) {
  return formatSignedMinutes(Math.round(min));
}

export function signColor(min) {
  if (min === 0) return COLORS.text;
  return min > 0 ? COLORS.sage : COLORS.amber;
}

// Page shell shared by every Hours view: scanline background, fixed-width
// column, room for the TopBar and NavBar.
export function Page({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 2px)",
        fontFamily: MONO,
        color: COLORS.text,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px", padding: `${TOPBAR_HEIGHT}px 0 ${100 + NAV_HEIGHT}px 0` }}>{children}</div>
    </div>
  );
}

export function Header({ title, sub, left, right }) {
  return (
    <div style={{ padding: "24px 20px 14px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "flex-end", gap: "10px" }}>
      {left}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "19px", fontWeight: 600, color: COLORS.amber, letterSpacing: "0.5px" }}>{title}</div>
        {sub && <div style={{ fontSize: "12px", color: COLORS.dim, marginTop: "4px" }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Section({ label, children, right, style }) {
  return (
    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}`, ...style }}>
      {(label || right) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
          <span style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "0.5px" }}>{label}</span>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

// Row of labelled figures: [{ label, value, color }]
export function Stats({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: "8px" }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{ minWidth: 0 }}>
          <div style={{ fontSize: "10.5px", color: COLORS.dim, marginBottom: "3px" }}>{label}</div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: color || COLORS.text, whiteSpace: "nowrap" }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

export function Badge({ children, color = COLORS.dim }) {
  return (
    <span
      style={{
        fontSize: "10px",
        padding: "2px 6px",
        borderRadius: "4px",
        border: `1px solid ${color}`,
        color,
        whiteSpace: "nowrap",
        letterSpacing: "0.3px",
      }}
    >
      {children}
    </span>
  );
}

// Colored chip for picking a code/break — same visual language as
// TagPickerChip (components/TagChip.jsx).
export function PickChip({ label, color, active, onClick }) {
  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "11px",
        padding: "6px 10px",
        borderRadius: "6px",
        border: `1px solid ${active ? color : COLORS.border}`,
        color: active ? color : COLORS.dim,
        background: active ? `${color}18` : "transparent",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

// `[×] label` checkbox in the bracket style used across the app.
export function BracketCheck({ checked, onChange, label }) {
  return (
    <span onClick={() => onChange(!checked)} style={{ fontSize: "12px", color: checked ? COLORS.text : COLORS.dim, cursor: "pointer", userSelect: "none" }}>
      <span style={{ color: checked ? COLORS.amber : COLORS.dim }}>{checked ? "[×]" : "[ ]"}</span> {label}
    </span>
  );
}

export function Row({ onClick, children, style }) {
  return (
    <div
      onClick={onClick}
      style={{ padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}`, cursor: onClick ? "pointer" : "default", ...style }}
    >
      {children}
    </div>
  );
}

export function Dot({ color, size = 8 }) {
  return <span style={{ width: `${size}px`, height: `${size}px`, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />;
}
