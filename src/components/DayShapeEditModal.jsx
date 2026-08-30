import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { DAY_LABELS } from "../lib/recurrence.js";
import { minutesToClock } from "../lib/dayPlan.js";

function timeToMin(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const fieldStyle = {
  background: "transparent",
  border: "none",
  outline: "none",
  color: COLORS.text,
  caretColor: COLORS.amber,
  fontFamily: "'IBM Plex Mono', monospace",
  colorScheme: "dark",
};

// Manages DayShapes (named sets of fixed blocks — commute, work, routines —
// see ARCHITECTURE.md §7 "Templates vs. routines/checklists") and each
// shape's weekday defaults, opened from the Day Planner view's day-shape switcher.
export function DayShapeEditModal({ dayShapes, onAdd, onUpdate, onRemove, onClose }) {
  const [selectedId, setSelectedId] = useState(dayShapes[0]?.id ?? null);
  const [newName, setNewName] = useState("");
  const selected = dayShapes.find((s) => s.id === selectedId);

  const addShape = () => {
    const name = newName.trim();
    if (!name) return;
    const shape = onAdd({ name });
    setNewName("");
    setSelectedId(shape.id);
  };

  const toggleWeekday = (d) => {
    if (!selected) return;
    const next = selected.weekdays.includes(d) ? selected.weekdays.filter((x) => x !== d) : [...selected.weekdays, d].sort();
    onUpdate(selected.id, { weekdays: next });
  };

  const updateBlock = (index, patch) => {
    const blocks = selected.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b));
    onUpdate(selected.id, { blocks });
  };

  const addBlock = () => {
    onUpdate(selected.id, { blocks: [...selected.blocks, { label: "", startMinutes: 9 * 60, durationMinutes: 30 }] });
  };

  const removeBlock = (index) => {
    onUpdate(selected.id, { blocks: selected.blocks.filter((_, i) => i !== index) });
  };

  const removeShape = () => {
    const remaining = dayShapes.filter((s) => s.id !== selected.id);
    onRemove(selected.id);
    setSelectedId(remaining[0]?.id ?? null);
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
          <span style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", textTransform: "uppercase" }}>day shapes</span>
          <span onClick={onClose} style={{ cursor: "pointer" }}>
            <X size={16} color={COLORS.dim} />
          </span>
        </div>

        {dayShapes.length > 0 && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
            {dayShapes.map((s) => (
              <span
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                style={{
                  fontSize: "11px",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: `1px solid ${s.id === selectedId ? COLORS.amber : COLORS.border}`,
                  color: s.id === selectedId ? COLORS.amber : COLORS.dim,
                  cursor: "pointer",
                }}
              >
                {s.name}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addShape();
            }}
            placeholder="new shape, e.g. weekend"
            style={{ ...fieldStyle, flex: 1, minWidth: 0, border: `1px solid ${COLORS.border}`, borderRadius: "6px", padding: "7px 10px", fontSize: "12.5px" }}
          />
          <button
            onClick={addShape}
            disabled={!newName.trim()}
            style={{
              background: newName.trim() ? COLORS.amber : COLORS.border,
              border: "none",
              color: newName.trim() ? COLORS.bg : COLORS.dim,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12.5px",
              fontWeight: 600,
              padding: "7px 12px",
              borderRadius: "6px",
              cursor: newName.trim() ? "pointer" : "default",
              flexShrink: 0,
            }}
          >
            add
          </button>
        </div>

        {selected && (
          <>
            <input
              value={selected.name}
              onChange={(e) => onUpdate(selected.id, { name: e.target.value })}
              style={{
                ...fieldStyle,
                width: "100%",
                border: `1px solid ${COLORS.border}`,
                borderRadius: "6px",
                fontSize: "14.5px",
                fontWeight: 600,
                padding: "9px 10px",
                marginBottom: "10px",
                boxSizing: "border-box",
              }}
            />

            <div style={{ fontSize: "10.5px", color: COLORS.dim, marginBottom: "6px" }}>default days</div>
            <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
              {DAY_LABELS.map((label, i) => {
                const active = selected.weekdays.includes(i);
                return (
                  <span
                    key={i}
                    onClick={() => toggleWeekday(i)}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      fontSize: "10.5px",
                      padding: "6px 0",
                      borderRadius: "5px",
                      background: active ? COLORS.amber : "transparent",
                      color: active ? COLORS.bg : COLORS.dim,
                      border: `1px solid ${active ? COLORS.amber : COLORS.border}`,
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </span>
                );
              })}
            </div>

            <div style={{ fontSize: "10.5px", color: COLORS.dim, marginBottom: "6px" }}>fixed blocks</div>
            {selected.blocks.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
                <input
                  value={b.label}
                  onChange={(e) => updateBlock(i, { label: e.target.value })}
                  placeholder="label"
                  style={{ ...fieldStyle, flex: 1, minWidth: 0, border: `1px solid ${COLORS.border}`, borderRadius: "5px", padding: "6px 8px", fontSize: "12px" }}
                />
                <input
                  type="time"
                  value={minutesToClock(b.startMinutes)}
                  onChange={(e) => updateBlock(i, { startMinutes: timeToMin(e.target.value) })}
                  style={{ ...fieldStyle, border: `1px solid ${COLORS.border}`, borderRadius: "5px", padding: "6px 4px", fontSize: "11.5px", width: "100px", flexShrink: 0 }}
                />
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={b.durationMinutes}
                  onChange={(e) => updateBlock(i, { durationMinutes: Math.max(5, Number(e.target.value) || 5) })}
                  style={{ ...fieldStyle, border: `1px solid ${COLORS.border}`, borderRadius: "5px", padding: "6px 4px", fontSize: "12px", width: "46px", flexShrink: 0 }}
                />
                <span onClick={() => removeBlock(i)} style={{ cursor: "pointer", flexShrink: 0 }}>
                  <X size={13} color={COLORS.dim} />
                </span>
              </div>
            ))}
            <button
              onClick={addBlock}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: `1px solid ${COLORS.border}`,
                color: COLORS.dim,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "11.5px",
                padding: "7px 10px",
                borderRadius: "6px",
                cursor: "pointer",
                marginBottom: "18px",
              }}
            >
              <Plus size={12} /> add block
            </button>

            <button
              onClick={removeShape}
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
              }}
            >
              <Trash2 size={13} strokeWidth={2} /> delete shape
            </button>
          </>
        )}

        {dayShapes.length === 0 && (
          <div style={{ color: COLORS.dim, fontSize: "12.5px", padding: "8px 0" }}>// no day shapes yet — add one above</div>
        )}
      </div>
    </div>
  );
}
