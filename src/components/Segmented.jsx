import { COLORS } from "../theme/colors.js";

// Generic N-option segmented switch — same look as SortSwitch, parametrized
// over arbitrary {key, label} options so Calendar's list/week/month and
// Templates' daily/weekly/monthly don't each need their own component.
export function Segmented({ value, onChange, options, fontSize = "11px" }) {
  return (
    <div
      style={{
        display: "flex",
        border: `1px solid ${COLORS.border}`,
        borderRadius: "6px",
        overflow: "hidden",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize,
      }}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{
              flex: 1,
              padding: "6px 10px",
              background: active ? COLORS.amber : "transparent",
              color: active ? COLORS.bg : COLORS.dim,
              border: "none",
              fontFamily: "inherit",
              fontSize: "inherit",
              fontWeight: active ? 600 : 400,
              cursor: "pointer",
              letterSpacing: "0.3px",
              whiteSpace: "nowrap",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
