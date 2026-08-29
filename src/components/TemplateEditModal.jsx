import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { Toggle } from "./Toggle.jsx";
import { Segmented } from "./Segmented.jsx";
import { TagPickerChip } from "./TagChip.jsx";
import { DAY_LABELS } from "../lib/recurrence.js";

const FREQ_OPTIONS = [
  { key: "daily", label: "daily" },
  { key: "weekly", label: "weekly" },
  { key: "monthly", label: "monthly" },
];

// Modal for editing an existing template's fields — opened by tapping the
// middle (info) area of a template row, mirroring TaskEditModal.
export function TemplateEditModal({ template, tags, onSave, onClose }) {
  const [text, setText] = useState(template.text);
  const [urgent, setUrgent] = useState(template.urgent);
  const [important, setImportant] = useState(template.important);
  const [templateTags, setTemplateTags] = useState(template.tags);
  const [recurring, setRecurring] = useState(!!template.recurring);
  const [freq, setFreq] = useState(template.recurring?.type || "daily");
  const [weekDays, setWeekDays] = useState(template.recurring?.type === "weekly" ? template.recurring.days : [0]);
  const [monthDay, setMonthDay] = useState(template.recurring?.type === "monthly" ? template.recurring.day : 1);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const toggleTag = (id) => {
    setTemplateTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleWeekDay = (d) => {
    setWeekDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    let nextRecurring = null;
    if (recurring) {
      if (freq === "daily") nextRecurring = { type: "daily" };
      else if (freq === "weekly") nextRecurring = { type: "weekly", days: weekDays.length ? weekDays : [0] };
      else if (freq === "monthly") nextRecurring = { type: "monthly", day: monthDay };
    }
    onSave({
      text: trimmed,
      urgent,
      important,
      tags: templateTags,
      recurring: nextRecurring,
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
            edit template
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
        <div style={{ marginBottom: recurring ? "12px" : "14px" }}>
          <Toggle value={recurring} onChange={setRecurring} leftLabel="one-off" rightLabel="recurring" />
        </div>
        {recurring && (
          <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: "6px", padding: "10px", marginBottom: "14px" }}>
            <div style={{ marginBottom: "10px" }}>
              <Segmented value={freq} onChange={setFreq} options={FREQ_OPTIONS} />
            </div>

            {freq === "weekly" && (
              <div style={{ display: "flex", gap: "4px" }}>
                {DAY_LABELS.map((label, i) => {
                  const active = weekDays.includes(i);
                  return (
                    <span
                      key={i}
                      onClick={() => toggleWeekDay(i)}
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
            )}

            {freq === "monthly" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11.5px", color: COLORS.dim }}>day of month</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={monthDay}
                  onChange={(e) => setMonthDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                  style={{
                    width: "56px",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "5px",
                    padding: "5px 8px",
                    fontSize: "13px",
                    background: "transparent",
                    color: COLORS.text,
                    fontFamily: "'IBM Plex Mono', monospace",
                    caretColor: COLORS.amber,
                  }}
                />
              </div>
            )}
          </div>
        )}
        {tags.length > 0 && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
            {tags.map((tag) => (
              <TagPickerChip key={tag.id} tag={tag} active={templateTags.includes(tag.id)} onClick={() => toggleTag(tag.id)} />
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
