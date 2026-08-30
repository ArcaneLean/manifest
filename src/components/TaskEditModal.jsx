import { useEffect, useRef, useState } from "react";
import { Hourglass, Flag, Clock, X } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { Toggle } from "./Toggle.jsx";
import { TagPickerChip } from "./TagChip.jsx";

// Modal for editing an existing task's fields — opened by tapping the
// middle (info) area of a task row. Left (checkbox) toggles completion,
// right (cross) deletes; this is the third interaction, for everything else.
export function TaskEditModal({ task, tags, onSave, onClose }) {
  const [text, setText] = useState(task.text);
  const [urgent, setUrgent] = useState(task.urgent);
  const [important, setImportant] = useState(task.important);
  const [taskTags, setTaskTags] = useState(task.tags);
  const [startDate, setStartDate] = useState(task.startDate || "");
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(task.estimatedMinutes ?? "");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const toggleTag = (id) => {
    setTaskTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSave({
      text: trimmed,
      urgent,
      important,
      tags: taskTags,
      startDate: startDate || null,
      dueDate: dueDate || null,
      estimatedMinutes: estimatedMinutes === "" ? null : Math.max(0, Number(estimatedMinutes) || 0),
    });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "420px",
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
            edit task
          </span>
          <span onClick={onClose} style={{ cursor: "pointer" }}>
            <X size={16} color={COLORS.dim} />
          </span>
        </div>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          rows={2}
          style={{
            width: "100%",
            resize: "none",
            background: "transparent",
            border: `1px solid ${COLORS.border}`,
            borderRadius: "6px",
            outline: "none",
            color: COLORS.text,
            caretColor: COLORS.amber,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "14.5px",
            padding: "10px",
            marginBottom: "12px",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
          <div style={{ flex: 1 }}>
            <Toggle value={urgent} onChange={setUrgent} leftLabel="not urgent" rightLabel="urgent" />
          </div>
          <div style={{ flex: 1 }}>
            <Toggle value={important} onChange={setImportant} leftLabel="not important" rightLabel="important" />
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              border: `1px solid ${COLORS.border}`,
              borderRadius: "6px",
              padding: "0 8px",
            }}
          >
            <Hourglass size={12} color={COLORS.dim} />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: COLORS.text,
                caretColor: COLORS.amber,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "12px",
                colorScheme: "dark",
                flex: 1,
                minWidth: 0,
                padding: "6px 0",
              }}
            />
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              border: `1px solid ${COLORS.border}`,
              borderRadius: "6px",
              padding: "0 8px",
            }}
          >
            <Flag size={12} color={COLORS.dim} />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: COLORS.text,
                caretColor: COLORS.amber,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "12px",
                colorScheme: "dark",
                flex: 1,
                minWidth: 0,
                padding: "6px 0",
              }}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            border: `1px solid ${COLORS.border}`,
            borderRadius: "6px",
            padding: "0 8px",
            marginBottom: "12px",
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
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: COLORS.text,
              caretColor: COLORS.amber,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12px",
              flex: 1,
              minWidth: 0,
              padding: "6px 0",
            }}
          />
          <span style={{ fontSize: "10.5px", color: COLORS.dim, flexShrink: 0 }}>min</span>
        </div>
        {tags.length > 0 && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
            {tags.map((tag) => (
              <TagPickerChip key={tag.id} tag={tag} active={taskTags.includes(tag.id)} onClick={() => toggleTag(tag.id)} />
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: `1px solid ${COLORS.border}`,
              color: COLORS.dim,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12.5px",
              padding: "7px 14px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!text.trim()}
            style={{
              background: text.trim() ? COLORS.amber : COLORS.border,
              border: "none",
              color: text.trim() ? COLORS.bg : COLORS.dim,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12.5px",
              fontWeight: 600,
              padding: "7px 14px",
              borderRadius: "6px",
              cursor: text.trim() ? "pointer" : "default",
            }}
          >
            save
          </button>
        </div>
      </div>
    </div>
  );
}
