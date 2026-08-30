import { useState } from "react";
import { X, Plus } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { Checkbox } from "./Checkbox.jsx";
import { minutesToClock } from "../lib/dayPlan.js";

const fieldStyle = {
  background: "transparent",
  border: "none",
  outline: "none",
  color: COLORS.text,
  caretColor: COLORS.amber,
  fontFamily: "'IBM Plex Mono', monospace",
  colorScheme: "dark",
};

function timeToMin(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function SectionHeader({ children }) {
  return (
    <div style={{ fontSize: "10.5px", color: COLORS.dim, letterSpacing: "0.5px", textTransform: "uppercase", margin: "18px 0 8px" }}>{children}</div>
  );
}

// Opened from Day Planner: builds up *this specific date's* plan without
// touching Task.startDate/dueDate or any habit schedule — see
// ARCHITECTURE.md §7 ("Day Planner: planning is opt-in"). Three independent
// sections: ad hoc blocks for just this date, which habits to plan, and
// which extra tasks to plan (tasks already on the day via a real due date
// still show in the main view regardless of what's toggled here).
export function PlanDayModal({
  dateLabel,
  habits,
  tasks,
  plannedHabitIds,
  plannedTaskIds,
  dueTaskIds,
  extraBlocks,
  onPlanHabit,
  onUnplanHabit,
  onPlanTask,
  onUnplanTask,
  onAddBlock,
  onUpdateBlock,
  onRemoveBlock,
  onClose,
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newDuration, setNewDuration] = useState(30);
  const [newAnchor, setNewAnchor] = useState("chained");
  const [newStart, setNewStart] = useState("09:00");

  const addBlock = () => {
    const label = newLabel.trim();
    if (!label) return;
    onAddBlock({
      label,
      durationMinutes: Math.max(5, Number(newDuration) || 5),
      anchor: newAnchor,
      startMinutes: newAnchor === "fixed" ? timeToMin(newStart) : null,
    });
    setNewLabel("");
    setNewDuration(30);
  };

  const plannableHabits = habits.filter((h) => h.type !== "negative");
  const plannableTasks = tasks.filter((t) => !t.done);

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", textTransform: "uppercase" }}>plan {dateLabel}</span>
          <span onClick={onClose} style={{ cursor: "pointer" }}>
            <X size={16} color={COLORS.dim} />
          </span>
        </div>

        <SectionHeader>block time (this date only)</SectionHeader>
        {extraBlocks.map((b) => (
          <div key={b.id} style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
            <input
              value={b.label}
              onChange={(e) => onUpdateBlock(b.id, { label: e.target.value })}
              style={{ ...fieldStyle, flex: 1, minWidth: 0, border: `1px solid ${COLORS.border}`, borderRadius: "5px", padding: "6px 8px", fontSize: "12px" }}
            />
            {b.anchor === "fixed" ? (
              <input
                type="time"
                value={minutesToClock(b.startMinutes ?? 9 * 60)}
                onChange={(e) => onUpdateBlock(b.id, { startMinutes: timeToMin(e.target.value) })}
                style={{ ...fieldStyle, border: `1px solid ${COLORS.border}`, borderRadius: "5px", padding: "6px 4px", fontSize: "11.5px", width: "88px", flexShrink: 0 }}
              />
            ) : (
              <span style={{ fontSize: "9.5px", color: COLORS.dim, width: "88px", flexShrink: 0 }}>after previous</span>
            )}
            <input
              type="number"
              min={5}
              step={5}
              value={b.durationMinutes}
              onChange={(e) => onUpdateBlock(b.id, { durationMinutes: Math.max(5, Number(e.target.value) || 5) })}
              style={{ ...fieldStyle, border: `1px solid ${COLORS.border}`, borderRadius: "5px", padding: "6px 4px", fontSize: "12px", width: "46px", flexShrink: 0 }}
            />
            <span onClick={() => onRemoveBlock(b.id)} style={{ cursor: "pointer", flexShrink: 0 }}>
              <X size={13} color={COLORS.dim} />
            </span>
          </div>
        ))}
        <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px" }}>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addBlock();
            }}
            placeholder="e.g. commute, buffer"
            style={{ ...fieldStyle, flex: 1, minWidth: 0, border: `1px solid ${COLORS.border}`, borderRadius: "5px", padding: "6px 8px", fontSize: "12px" }}
          />
          <input
            type="number"
            min={5}
            step={5}
            value={newDuration}
            onChange={(e) => setNewDuration(e.target.value)}
            style={{ ...fieldStyle, border: `1px solid ${COLORS.border}`, borderRadius: "5px", padding: "6px 4px", fontSize: "12px", width: "46px", flexShrink: 0 }}
          />
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "16px" }}>
          <span
            onClick={() => setNewAnchor("chained")}
            style={{ fontSize: "9.5px", padding: "3px 8px", borderRadius: "5px", border: `1px solid ${newAnchor === "chained" ? COLORS.amber : COLORS.border}`, color: newAnchor === "chained" ? COLORS.amber : COLORS.dim, cursor: "pointer" }}
          >
            after previous
          </span>
          <span
            onClick={() => setNewAnchor("fixed")}
            style={{ fontSize: "9.5px", padding: "3px 8px", borderRadius: "5px", border: `1px solid ${newAnchor === "fixed" ? COLORS.amber : COLORS.border}`, color: newAnchor === "fixed" ? COLORS.amber : COLORS.dim, cursor: "pointer" }}
          >
            fixed time
          </span>
          {newAnchor === "fixed" && (
            <input
              type="time"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              style={{ ...fieldStyle, border: `1px solid ${COLORS.border}`, borderRadius: "5px", padding: "5px 6px", fontSize: "11.5px" }}
            />
          )}
          <button
            onClick={addBlock}
            disabled={!newLabel.trim()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "none",
              border: `1px solid ${COLORS.border}`,
              color: COLORS.dim,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "11px",
              padding: "5px 9px",
              borderRadius: "5px",
              cursor: newLabel.trim() ? "pointer" : "default",
              marginLeft: "auto",
            }}
          >
            <Plus size={11} /> add
          </button>
        </div>

        <SectionHeader>habits to plan</SectionHeader>
        {plannableHabits.length === 0 && <div style={{ fontSize: "11.5px", color: COLORS.dim }}>// no habits yet</div>}
        {plannableHabits.map((h) => {
          const planned = plannedHabitIds.includes(h.id);
          return (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0" }}>
              <span onClick={() => (planned ? onUnplanHabit(h.id) : onPlanHabit(h.id))} style={{ cursor: "pointer" }}>
                <Checkbox done={planned} />
              </span>
              <span style={{ fontSize: "12.5px", color: COLORS.text, flex: 1 }}>{h.name}</span>
              {!h.estimatedMinutes && <span style={{ fontSize: "9.5px", color: COLORS.dim }}>no estimate</span>}
            </div>
          );
        })}

        <SectionHeader>tasks to plan</SectionHeader>
        {plannableTasks.length === 0 && <div style={{ fontSize: "11.5px", color: COLORS.dim }}>// no open tasks</div>}
        {plannableTasks.map((t) => {
          const planned = plannedTaskIds.includes(t.id);
          const alreadyDue = dueTaskIds.has(t.id);
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0" }}>
              <span onClick={() => (planned ? onUnplanTask(t.id) : onPlanTask(t.id))} style={{ cursor: "pointer" }}>
                <Checkbox done={planned} />
              </span>
              <span style={{ fontSize: "12.5px", color: COLORS.text, flex: 1 }}>{t.text}</span>
              {alreadyDue && <span style={{ fontSize: "9.5px", color: COLORS.dim }}>already due</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
