// Small shared bits for the Hobbies views — see ARCHITECTURE.md §7 ("Hobbies").
import { COLORS } from "../../theme/colors.js";

export function GroupLabel({ children, color = COLORS.dim }) {
  return <div style={{ padding: "14px 20px 6px", fontSize: "11px", color, letterSpacing: "0.5px", borderBottom: `1px solid ${COLORS.border}` }}>{children}</div>;
}
