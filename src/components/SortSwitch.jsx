import { COLORS } from "../theme/colors.js";

const OPTIONS = [
  { key: "added", label: "added" },
  { key: "priority", label: "priority" },
  { key: "due", label: "due" },
  { key: "tag", label: "tag" },
];

export function SortSwitch({ value, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        border: `1px solid ${COLORS.border}`,
        borderRadius: "6px",
        overflow: "hidden",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "10.5px",
      }}
    >
      {OPTIONS.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{
              padding: "5px 9px",
              background: active ? COLORS.amber : "transparent",
              color: active ? COLORS.bg : COLORS.dim,
              border: "none",
              fontFamily: "inherit",
              fontSize: "inherit",
              fontWeight: active ? 600 : 400,
              cursor: "pointer",
              letterSpacing: "0.3px",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
