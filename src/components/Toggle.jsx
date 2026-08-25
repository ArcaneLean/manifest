import { COLORS } from "../theme/colors.js";

export function Toggle({ value, onChange, leftLabel, rightLabel }) {
  return (
    <div
      style={{
        display: "flex",
        border: `1px solid ${COLORS.border}`,
        borderRadius: "6px",
        overflow: "hidden",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11.5px",
      }}
    >
      {[false, true].map((v) => {
        const active = value === v;
        const label = v ? rightLabel : leftLabel;
        return (
          <button
            key={String(v)}
            onClick={() => onChange(v)}
            style={{
              flex: 1,
              padding: "7px 10px",
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
            {label}
          </button>
        );
      })}
    </div>
  );
}
