import { COLORS } from "../theme/colors.js";

export function Checkbox({ done }) {
  return (
    <span
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        color: done ? COLORS.sage : COLORS.amber,
        fontSize: "15px",
        letterSpacing: "0.5px",
        width: "30px",
        flexShrink: 0,
        userSelect: "none",
        textShadow: done ? "none" : `0 0 8px ${COLORS.amberDim}`,
      }}
    >
      {done ? "[×]" : "[ ]"}
    </span>
  );
}
