import { COLORS } from "../theme/colors.js";

// See ARCHITECTURE.md §4 — was duplicated across 3 prototype files.
export const QUADRANTS = {
  do: { label: "do now", color: COLORS.amber, rank: 0 },
  schedule: { label: "schedule", color: COLORS.sage, rank: 1 },
  delegate: { label: "delegate", color: COLORS.amberDim, rank: 2 },
  drop: { label: "drop", color: COLORS.dim, rank: 3 },
};

export function quadrantFor(urgent, important) {
  if (urgent && important) return "do";
  if (!urgent && important) return "schedule";
  if (urgent && !important) return "delegate";
  return "drop";
}
