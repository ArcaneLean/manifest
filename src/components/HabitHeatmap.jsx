import { COLORS } from "../theme/colors.js";
import { buildHeatmapGrid } from "../lib/habitStats.js";

// Solid fill for a logged day, dim border color for an empty one. Habits are
// realistically logged at most once/day, so a count-based alpha ramp left
// nearly every filled cell at its dimmest tier — a flat boolean fill reads
// far more clearly on the dark panel background.
function cellColor(count, color) {
  return count > 0 ? color : COLORS.border;
}

// GitHub-style contribution grid — `weeks` columns of 7 day-cells, filled
// solid on days with at least one entry. `color` picks the fill color (sage
// for positive habits, danger for negative ones).
export function HabitHeatmap({ timestamps, weeks, today, color = COLORS.sage, cellSize = 9, gap = 2 }) {
  const columns = buildHeatmapGrid(timestamps, weeks, today);

  return (
    <div style={{ display: "flex", gap: `${gap}px` }}>
      {columns.map((days, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: `${gap}px` }}>
          {days.map((day) => (
            <div
              key={day.iso}
              title={day.future ? undefined : `${day.iso} · ${day.count}×`}
              style={{
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                borderRadius: "2px",
                background: day.future ? "transparent" : cellColor(day.count, color),
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
