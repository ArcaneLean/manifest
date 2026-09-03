import { COLORS, TAG_PALETTE } from "../theme/colors.js";

// Curated swatch picker over TAG_PALETTE — shared by TagsView (tag colors)
// and ManageCalendarsModal (per-calendar colors).
export function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      {TAG_PALETTE.map((c) => (
        <span
          key={c}
          onClick={() => onChange(c)}
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: c,
            cursor: "pointer",
            border: value === c ? `2px solid ${COLORS.text}` : "2px solid transparent",
            boxShadow: value === c ? `0 0 0 2px ${COLORS.bg}` : "none",
          }}
        />
      ))}
    </div>
  );
}
