import { Play, X } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { QUADRANTS, quadrantFor } from "../lib/quadrant.js";
import { TagChip } from "./TagChip.jsx";
import { parseISODate, daysBetween } from "../lib/dateUtils.js";
import { describeRecurrence } from "../lib/recurrence.js";

function CounterBadge({ days }) {
  const isDue = days <= 0;
  const padded = String(Math.min(Math.max(days, 0), 999)).padStart(3, "0");
  return (
    <span
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "13px",
        fontWeight: 600,
        color: isDue ? COLORS.sage : COLORS.amber,
        width: "54px",
        flexShrink: 0,
        userSelect: "none",
        letterSpacing: "0.3px",
        textShadow: isDue ? `0 0 10px ${COLORS.sage}` : `0 0 8px ${COLORS.amberDim}`,
      }}
    >
      {isDue ? "[DUE]" : `[${padded}]`}
    </span>
  );
}

// Shared row for both the Templates (one-off) and Recurring views — see
// ARCHITECTURE.md §5. `anchorDate` (a recurring template's open anchor
// task's due/start date) drives the counter badge and is null for one-off
// templates, which show a "run" button instead.
export function TemplateRow({ template, today, anchorDate, tagById, onRun, onDelete, onEdit }) {
  const q = QUADRANTS[quadrantFor(template.urgent, template.important)];
  const isRecurring = !!template.recurring;
  const daysUntil = anchorDate ? daysBetween(today, parseISODate(anchorDate)) : null;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "14px 16px 14px 16px", borderBottom: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${q.color}` }}>
      {isRecurring && daysUntil !== null && <CounterBadge days={daysUntil} />}
      <div onClick={() => onEdit(template.id)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
        <div style={{ fontSize: "14.5px", color: COLORS.text, lineHeight: "1.4", wordBreak: "break-word" }}>{template.text}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "10px", letterSpacing: "0.5px", color: q.color, textTransform: "uppercase" }}>{q.label}</span>
          {isRecurring && <span style={{ fontSize: "10px", color: COLORS.dim }}>· {describeRecurrence(template.recurring)}</span>}
          {template.tags.map((tid) => {
            const tag = tagById(tid);
            return tag ? <TagChip key={tid} tag={tag} small /> : null;
          })}
        </div>
      </div>
      {!isRecurring && (
        <button
          onClick={() => onRun(template)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            background: COLORS.amber,
            border: "none",
            color: COLORS.bg,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "11.5px",
            fontWeight: 600,
            padding: "7px 11px",
            borderRadius: "6px",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Play size={11} fill={COLORS.bg} />
          run
        </button>
      )}
      <span onClick={() => onDelete(template.id)} style={{ cursor: "pointer", flexShrink: 0, paddingTop: "4px" }}>
        <X size={13} color={COLORS.dim} />
      </span>
    </div>
  );
}
