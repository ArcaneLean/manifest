import { Hourglass, Clock } from "lucide-react";
import { COLORS } from "../theme/colors.js";

export function ScheduledToggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      title={value ? "hide scheduled tasks" : "show scheduled tasks"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "26px",
        height: "26px",
        background: "none",
        border: `1px solid ${COLORS.border}`,
        borderRadius: "6px",
        cursor: "pointer",
      }}
    >
      {value ? <Hourglass size={13} color={COLORS.amber} /> : <Clock size={13} color={COLORS.dim} />}
    </button>
  );
}
