import { Eye, EyeOff } from "lucide-react";
import { COLORS } from "../theme/colors.js";

export function CompletedToggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      title={value ? "hide completed tasks" : "show completed tasks"}
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
      {value ? <Eye size={13} color={COLORS.amber} /> : <EyeOff size={13} color={COLORS.dim} />}
    </button>
  );
}
