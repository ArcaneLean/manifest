import { COLORS } from "../theme/colors.js";

export function TagChip({ tag, small }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: small ? "9px" : "10px",
        padding: small ? "1px 6px" : "2px 7px",
        borderRadius: "10px",
        border: `1px solid ${tag.color}55`,
        color: tag.color,
        background: `${tag.color}18`,
        letterSpacing: "0.2px",
      }}
    >
      {tag.name}
    </span>
  );
}

export function TagPickerChip({ tag, active, onClick }) {
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
        border: `1px solid ${active ? tag.color : COLORS.border}`,
        color: active ? tag.color : COLORS.dim,
        background: active ? `${tag.color}18` : "transparent",
        cursor: "pointer",
      }}
    >
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: tag.color, flexShrink: 0 }} />
      {tag.name}
    </span>
  );
}
