import { COLORS, withAlpha } from "../theme/colors.js";
import { buildHeatmapGrid } from "../lib/habitStats.js";

const INTENSITY_ALPHAS = [0.28, 0.5, 0.72, 1];

function cellColor(count, color) {
  if (count <= 0) return COLORS.border;
  const level = Math.min(INTENSITY_ALPHAS.length, count) - 1;
  return withAlpha(color, INTENSITY_ALPHAS[level]);
}

// GitHub-style contribution grid — `weeks` columns of 7 day-cells, shaded by
// how many entries landed on that day. `color` picks the intensity ramp
// (sage for positive habits, danger for negative ones).
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
