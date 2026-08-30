import { useState } from "react";
import { X, Flame, Trash2, Clock } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { Toggle } from "./Toggle.jsx";
import { HabitHeatmap } from "./HabitHeatmap.jsx";
import { habitStats, formatRelativeTime } from "../lib/habitStats.js";
import { startOfToday } from "../lib/dateUtils.js";

const fieldStyle = {
  background: "transparent",
  border: "none",
  outline: "none",
  color: COLORS.text,
  caretColor: COLORS.amber,
  fontFamily: "'IBM Plex Mono', monospace",
  colorScheme: "dark",
};

function StatTile({ label, value }) {
  return (
    <div style={{ flex: 1, border: `1px solid ${COLORS.border}`, borderRadius: "6px", padding: "8px 6px", textAlign: "center" }}>
      <div style={{ fontSize: "13px", color: COLORS.text, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: "9.5px", color: COLORS.dim, marginTop: "3px", letterSpacing: "0.5px" }}>{label}</div>
    </div>
  );
}

// Bottom-sheet opened by tapping a habit row: rename/type, full-year
// heatmap, quick-log + backfill, and the raw recent entries (each
// individually deletable, for correcting a mis-tap).
export function HabitDetailModal({ habit, entries, now, onLog, onBackfill, onRemoveEntry, onRename, onDelete, onClose }) {
  const [name, setName] = useState(habit.name);
  const [backfillDate, setBackfillDate] = useState("");
  const [backfillTime, setBackfillTime] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(habit.estimatedMinutes ?? "");

  const timestamps = entries.map((e) => e.ts);
  const stats = habitStats(timestamps, now);
  const color = habit.type === "negative" ? COLORS.danger : COLORS.sage;
  const today = startOfToday();
  const recent = [...entries].sort((a, b) => b.ts - a.ts).slice(0, 8);

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== habit.name) onRename({ name: trimmed });
    else if (!trimmed) setName(habit.name);
  };

  const commitEstimate = () => {
    const v = estimatedMinutes === "" ? null : Math.max(0, Number(estimatedMinutes) || 0);
    if (v !== (habit.estimatedMinutes ?? null)) onRename({ estimatedMinutes: v });
  };

  const commitBackfill = () => {
    if (!backfillDate) return;
    const [y, m, d] = backfillDate.split("-").map(Number);
    const [hh, mm] = (backfillTime || "12:00").split(":").map(Number);
    onBackfill(new Date(y, m - 1, d, hh, mm).getTime());
    setBackfillDate("");
    setBackfillTime("");
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "420px",
          maxHeight: "85vh",
          overflowY: "auto",
          background: COLORS.panel,
          border: `1px solid ${COLORS.borderBright}`,
          borderBottom: "none",
          borderTopLeftRadius: "10px",
          borderTopRightRadius: "10px",
          padding: "18px 20px 22px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <span style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", textTransform: "uppercase" }}>
            habit detail
          </span>
          <span onClick={onClose} style={{ cursor: "pointer" }}>
            <X size={16} color={COLORS.dim} />
          </span>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          style={{
            ...fieldStyle,
            width: "100%",
            border: `1px solid ${COLORS.border}`,
            borderRadius: "6px",
            fontSize: "15px",
            fontWeight: 600,
            padding: "9px 10px",
            marginBottom: "10px",
            boxSizing: "border-box",
          }}
        />
        <div style={{ marginBottom: "16px" }}>
          <Toggle
            value={habit.type === "negative"}
            onChange={(v) => onRename({ type: v ? "negative" : "positive" })}
            leftLabel="positive"
            rightLabel="negative"
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            border: `1px solid ${COLORS.border}`,
            borderRadius: "6px",
            padding: "0 8px",
            marginBottom: "16px",
            width: "140px",
          }}
        >
          <Clock size={12} color={COLORS.dim} />
          <input
            type="number"
            min={0}
            step={5}
            placeholder="estimate"
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0))}
            onBlur={commitEstimate}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            style={{ ...fieldStyle, fontSize: "12px", flex: 1, minWidth: 0, padding: "6px 0" }}
          />
          <span style={{ fontSize: "10.5px", color: COLORS.dim, flexShrink: 0 }}>min</span>
        </div>
        <div style={{ fontSize: "10px", color: COLORS.dim, marginTop: "-10px", marginBottom: "16px" }}>for today's plan, if tracked</div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <StatTile label="last" value={formatRelativeTime(stats.lastTs, now)} />
          <StatTile label="last 7d" value={String(stats.last7)} />
          <StatTile label="last 30d" value={String(stats.last30)} />
          <StatTile label="avg gap" value={stats.avgGapDays != null ? `${stats.avgGapDays.toFixed(1)}d` : "—"} />
        </div>

        <div style={{ fontSize: "11px", color: COLORS.dim, marginBottom: "6px" }}>last 52 weeks</div>
        <div style={{ overflowX: "auto", paddingBottom: "6px", marginBottom: "16px" }}>
          <HabitHeatmap timestamps={timestamps} weeks={52} today={today} color={color} cellSize={11} gap={3} />
        </div>

        <button
          onClick={onLog}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            background: color,
            border: "none",
            borderRadius: "6px",
            color: COLORS.bg,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "13px",
            fontWeight: 600,
            padding: "10px",
            cursor: "pointer",
            marginBottom: "14px",
          }}
        >
          <Flame size={14} strokeWidth={2} /> log now
        </button>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "18px" }}>
          <div style={{ flex: 1, border: `1px solid ${COLORS.border}`, borderRadius: "6px", padding: "0 8px" }}>
            <input type="date" value={backfillDate} onChange={(e) => setBackfillDate(e.target.value)} style={{ ...fieldStyle, fontSize: "12px", width: "100%", padding: "7px 0" }} />
          </div>
          <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: "6px", padding: "0 8px" }}>
            <input type="time" value={backfillTime} onChange={(e) => setBackfillTime(e.target.value)} style={{ ...fieldStyle, fontSize: "12px", padding: "7px 0" }} />
          </div>
          <button
            onClick={commitBackfill}
            disabled={!backfillDate}
            style={{
              background: "none",
              border: `1px solid ${COLORS.border}`,
              color: backfillDate ? COLORS.dim : COLORS.border,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "11.5px",
              padding: "8px 10px",
              borderRadius: "6px",
              cursor: backfillDate ? "pointer" : "default",
              flexShrink: 0,
            }}
          >
            backfill
          </button>
        </div>

        <div style={{ fontSize: "11px", color: COLORS.dim, marginBottom: "6px" }}>recent logs</div>
        {recent.length === 0 && (
          <div style={{ color: COLORS.dim, fontSize: "12.5px", padding: "8px 0" }}>// no logs yet</div>
        )}
        {recent.map((e) => (
          <div
            key={e.id}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${COLORS.border}` }}
          >
            <span style={{ fontSize: "12.5px", color: COLORS.text }}>
              {new Date(e.ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
            <span onClick={() => onRemoveEntry(e.id)} style={{ cursor: "pointer" }} aria-label="Remove log">
              <X size={12} color={COLORS.dim} />
            </span>
          </div>
        ))}

        <button
          onClick={onDelete}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            background: "none",
            border: `1px solid ${COLORS.border}`,
            borderRadius: "6px",
            color: COLORS.dim,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "12px",
            padding: "9px",
            cursor: "pointer",
            marginTop: "20px",
          }}
        >
          <Trash2 size={13} strokeWidth={2} /> delete habit
        </button>
      </div>
    </div>
  );
}
