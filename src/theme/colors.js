// "Terminal Log" theme — see ARCHITECTURE.md §3.
// Single source of truth; prototypes/ still hardcode their own copies.
export const COLORS = {
  bg: "#0d0d0c",
  panel: "#141310",
  border: "#2a2620",
  borderBright: "#3d3826",
  text: "#e8dcc8",
  dim: "#6b6459",
  amber: "#ffb000",
  amberDim: "#8a6a2a",
  sage: "#7c9070",
  // Negative-habit accent — a separate hue from both the priority colors
  // and TAG_PALETTE, so "habit I'm trying to cut down on" reads distinctly
  // from either coding system.
  danger: "#b5453d",
};

// Applies alpha to one of the hex colors above, e.g. for heatmap intensity
// levels. `hex` must be a plain "#rrggbb" string (no shorthand/alpha).
export function withAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Curated tag palette — a deliberately separate hue family from the
// priority colors above, so tag chips never compete with priority stripes.
export const TAG_PALETTE = [
  "#6b8fb5", // steel blue
  "#a78bc4", // lavender
  "#c47b8b", // dusty rose
  "#5fa8a0", // teal
  "#c4a05f", // ochre
  "#8b9dc4", // periwinkle
  "#c48b5f", // terracotta
  "#7fb37a", // moss green
];
