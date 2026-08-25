import React, { useState, useRef, useEffect } from "react";
import { Plus, Play, X } from "lucide-react";

const COLORS = {
  bg: "#0d0d0c",
  panel: "#141310",
  border: "#2a2620",
  borderBright: "#3d3826",
  text: "#e8dcc8",
  dim: "#6b6459",
  amber: "#ffb000",
  amberDim: "#8a6a2a",
  sage: "#7c9070",
};

const QUADRANTS = {
  do: { label: "do now", color: COLORS.amber, rank: 0 },
  schedule: { label: "schedule", color: COLORS.sage, rank: 1 },
  delegate: { label: "delegate", color: COLORS.amberDim, rank: 2 },
  drop: { label: "drop", color: COLORS.dim, rank: 3 },
};

function quadrantFor(urgent, important) {
  if (urgent && important) return "do";
  if (!urgent && important) return "schedule";
  if (urgent && !important) return "delegate";
  return "drop";
}

const DAY_LABELS = ["mo", "tu", "we", "th", "fr", "sa", "su"];

// --- date helpers ---------------------------------------------------

function startOfToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function daysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((b - a) / MS);
}

function advanceOnce(rule, date) {
  const d = new Date(date);
  if (rule.type === "daily") {
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (rule.type === "weekly") {
    let cur = new Date(d);
    for (let i = 0; i < 7; i++) {
      cur.setDate(cur.getDate() + 1);
      const wd = (cur.getDay() + 6) % 7;
      if (rule.days.includes(wd)) return cur;
    }
    return cur;
  }
  if (rule.type === "monthly") {
    const cur = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const lastDay = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
    cur.setDate(Math.min(rule.day, lastDay));
    return cur;
  }
  return d;
}

function nextDueDate(rule, lastRun, today) {
  if (!lastRun) return today;
  let candidate = advanceOnce(rule, lastRun);
  let guard = 0;
  while (candidate < today && guard < 400) {
    candidate = advanceOnce(rule, candidate);
    guard++;
  }
  return candidate;
}

function describeRecurrence(rule) {
  if (!rule) return "";
  if (rule.type === "daily") return "every day";
  if (rule.type === "weekly") {
    if (rule.days.length === 0) return "weekly";
    return rule.days
      .slice()
      .sort((a, b) => a - b)
      .map((d) => DAY_LABELS[d])
      .join(", ");
  }
  if (rule.type === "monthly") return `monthly · ${rule.day}${ordinal(rule.day)}`;
  return "";
}

function ordinal(n) {
  if (n % 10 === 1 && n !== 11) return "st";
  if (n % 10 === 2 && n !== 12) return "nd";
  if (n % 10 === 3 && n !== 13) return "rd";
  return "th";
}

// same tags model as the tags view
const TAGS = [
  { id: 1, name: "work", color: "#6b8fb5" },
  { id: 2, name: "personal", color: "#c47b8b" },
  { id: 3, name: "health", color: "#7fb37a" },
  { id: 4, name: "admin", color: "#c4a05f" },
  { id: 5, name: "family", color: "#a78bc4" },
];

function tagById(id) {
  return TAGS.find((t) => t.id === id);
}

// --- seed data ---------------------------------------------------

const today0 = startOfToday();

const initialTemplates = [
  { id: 1, text: "Buy groceries for the week", urgent: false, important: false, recurring: null, lastRun: null, tags: [2] },
  {
    id: 2,
    text: "Log hours in Blenddata timesheet",
    urgent: true,
    important: true,
    recurring: { type: "weekly", days: [4] },
    lastRun: new Date(today0.getFullYear(), today0.getMonth(), today0.getDate() - 7),
    tags: [1, 4],
  },
  {
    id: 3,
    text: "Review priorities in the matrix",
    urgent: false,
    important: true,
    recurring: { type: "monthly", day: 1 },
    lastRun: null,
    tags: [1],
  },
  {
    id: 4,
    text: "Check calendar for the day",
    urgent: true,
    important: true,
    recurring: { type: "daily" },
    lastRun: new Date(today0.getFullYear(), today0.getMonth(), today0.getDate() - 1),
    tags: [],
  },
];

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Toggle({ value, onChange, leftLabel, rightLabel }) {
  return (
    <div
      style={{
        display: "flex",
        border: `1px solid ${COLORS.border}`,
        borderRadius: "6px",
        overflow: "hidden",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11.5px",
      }}
    >
      {[false, true].map((v) => {
        const active = value === v;
        const label = v ? rightLabel : leftLabel;
        return (
          <button
            key={String(v)}
            onClick={() => onChange(v)}
            style={{
              flex: 1,
              padding: "7px 10px",
              background: active ? COLORS.amber : "transparent",
              color: active ? COLORS.bg : COLORS.dim,
              border: "none",
              fontFamily: "inherit",
              fontSize: "inherit",
              fontWeight: active ? 600 : 400,
              cursor: "pointer",
              letterSpacing: "0.3px",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function SegSwitch({ value, onChange, options }) {
  return (
    <div
      style={{
        display: "flex",
        border: `1px solid ${COLORS.border}`,
        borderRadius: "6px",
        overflow: "hidden",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11px",
      }}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{
              flex: 1,
              padding: "6px 8px",
              background: active ? COLORS.amber : "transparent",
              color: active ? COLORS.bg : COLORS.dim,
              border: "none",
              fontFamily: "inherit",
              fontSize: "inherit",
              fontWeight: active ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

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

function TagChip({ tag, small }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: small ? "9px" : "10px",
        padding: small ? "1px 6px" : "2px 7px",
        borderRadius: "10px",
        border: `1px solid ${tag.color}55`,
        color: tag.color,
        background: `${tag.color}18`,
        letterSpacing: "0.2px",
      }}
    >
      {tag.name}
    </span>
  );
}

function TagPickerChip({ tag, active, onClick }) {
  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "11px",
        padding: "6px 10px",
        borderRadius: "6px",
        border: `1px solid ${active ? tag.color : COLORS.border}`,
        color: active ? tag.color : COLORS.dim,
        background: active ? `${tag.color}18` : "transparent",
        cursor: "pointer",
      }}
    >
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: tag.color, flexShrink: 0 }} />
      {tag.name}
    </span>
  );
}

function TemplateRow({ template, today, onRun, onDelete }) {
  const q = QUADRANTS[quadrantFor(template.urgent, template.important)];
  const isRecurring = !!template.recurring;
  const due = isRecurring ? nextDueDate(template.recurring, template.lastRun, today) : null;
  const daysUntil = isRecurring ? daysBetween(today, due) : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "14px 16px 14px 16px",
        borderBottom: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${q.color}`,
      }}
    >
      {isRecurring && <CounterBadge days={daysUntil} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "14.5px", color: COLORS.text, lineHeight: "1.4", wordBreak: "break-word" }}>
          {template.text}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "10px",
              letterSpacing: "0.5px",
              color: q.color,
              textTransform: "uppercase",
            }}
          >
            {q.label}
          </span>
          {isRecurring && (
            <span style={{ fontSize: "10px", color: COLORS.dim }}>· {describeRecurrence(template.recurring)}</span>
          )}
          {template.tags.map((tid) => {
            const tag = tagById(tid);
            return tag ? <TagChip key={tid} tag={tag} small /> : null;
          })}
        </div>
      </div>
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
      <span onClick={() => onDelete(template.id)} style={{ cursor: "pointer", flexShrink: 0, paddingTop: "4px" }}>
        <X size={13} color={COLORS.dim} />
      </span>
    </div>
  );
}

export default function TemplatesView() {
  const [templates, setTemplates] = useState(initialTemplates);
  const [runLog, setRunLog] = useState([]);
  const [building, setBuilding] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [draftUrgent, setDraftUrgent] = useState(false);
  const [draftImportant, setDraftImportant] = useState(false);
  const [draftRecurring, setDraftRecurring] = useState(false);
  const [draftFreq, setDraftFreq] = useState("daily");
  const [draftWeekDays, setDraftWeekDays] = useState([0]);
  const [draftMonthDay, setDraftMonthDay] = useState(1);
  const [draftTags, setDraftTags] = useState([]);
  const [filterTags, setFilterTags] = useState([]);
  const [groupByTag, setGroupByTag] = useState(false);
  const textRef = useRef(null);
  const now = useClock();
  const today = startOfToday();

  useEffect(() => {
    if (building && textRef.current) textRef.current.focus();
  }, [building]);

  const runTemplate = (template) => {
    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    setRunLog((prev) => [{ id: Date.now(), text: template.text, time }, ...prev].slice(0, 5));
    if (template.recurring) {
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, lastRun: today } : t)));
    }
  };

  const removeTemplate = (id) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleWeekDay = (d) => {
    setDraftWeekDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const toggleDraftTag = (id) => {
    setDraftTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleFilterTag = (id) => {
    setFilterTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const cancelBuild = () => {
    setBuilding(false);
    setTextDraft("");
    setDraftUrgent(false);
    setDraftImportant(false);
    setDraftRecurring(false);
    setDraftFreq("daily");
    setDraftWeekDays([0]);
    setDraftMonthDay(1);
    setDraftTags([]);
  };

  const saveTemplate = () => {
    const trimmed = textDraft.trim();
    if (!trimmed) return;
    let recurring = null;
    if (draftRecurring) {
      if (draftFreq === "daily") recurring = { type: "daily" };
      else if (draftFreq === "weekly") recurring = { type: "weekly", days: draftWeekDays.length ? draftWeekDays : [0] };
      else if (draftFreq === "monthly") recurring = { type: "monthly", day: draftMonthDay };
    }
    setTemplates((prev) => [
      ...prev,
      { id: Date.now(), text: trimmed, urgent: draftUrgent, important: draftImportant, recurring, lastRun: null, tags: draftTags },
    ]);
    cancelBuild();
  };

  const dateStr = now
    .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })
    .toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 2px)",
        fontFamily: "'IBM Plex Mono', monospace",
        color: COLORS.text,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .fab { transition: transform 0.12s ease; }
        .fab:active { transform: scale(0.94); }
        .field-input { background: transparent; border: none; outline: none; color: ${COLORS.text};
          font-family: 'IBM Plex Mono', monospace; font-size: 14px; caret-color: ${COLORS.amber}; width: 100%; }
        .field-input::placeholder { color: ${COLORS.dim}; opacity: 1; }
        .day-chip { transition: background 0.12s ease; cursor: pointer; }
        .filter-scroll { overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none; }
        .filter-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ width: "100%", maxWidth: "420px", padding: "0 0 100px 0" }}>
        {/* Header */}
        <div style={{ padding: "28px 20px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", marginBottom: "6px" }}>
            {dateStr} · {timeStr}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600, color: COLORS.amber, letterSpacing: "0.5px" }}>
            ~/templates
          </div>
          <div style={{ fontSize: "12px", color: COLORS.dim, marginTop: "4px" }}>
            {templates.length} saved · {templates.filter((t) => t.recurring).length} recurring
          </div>
        </div>

        {/* Tag filter bar */}
        <div
          className="filter-scroll"
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 20px", borderBottom: `1px solid ${COLORS.border}` }}
        >
          {TAGS.map((tag) => (
            <TagPickerChip key={tag.id} tag={tag} active={filterTags.includes(tag.id)} onClick={() => toggleFilterTag(tag.id)} />
          ))}
          <span style={{ flex: 1 }} />
          <button
            onClick={() => setGroupByTag((v) => !v)}
            style={{
              background: groupByTag ? COLORS.amber : "transparent",
              border: `1px solid ${groupByTag ? COLORS.amber : COLORS.border}`,
              color: groupByTag ? COLORS.bg : COLORS.dim,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10.5px",
              fontWeight: groupByTag ? 600 : 400,
              padding: "6px 10px",
              borderRadius: "6px",
              cursor: "pointer",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            group by tag
          </button>
        </div>

        {/* List */}
        <div>
          {groupByTag
            ? (() => {
                const filtered =
                  filterTags.length === 0
                    ? templates
                    : templates.filter((t) => t.tags.some((tid) => filterTags.includes(tid)));
                const groups = TAGS.map((tag) => ({
                  tag,
                  items: filtered.filter((t) => t.tags[0] === tag.id),
                })).filter((g) => g.items.length > 0);
                const untagged = filtered.filter((t) => t.tags.length === 0);
                if (untagged.length > 0) groups.push({ tag: null, items: untagged });
                return groups.map((group) => (
                  <div key={group.tag ? group.tag.id : "untagged"}>
                    <div
                      style={{
                        padding: "8px 20px",
                        fontSize: "10.5px",
                        letterSpacing: "0.5px",
                        color: group.tag ? group.tag.color : COLORS.dim,
                        background: COLORS.panel,
                        borderBottom: `1px solid ${COLORS.border}`,
                        textTransform: "uppercase",
                      }}
                    >
                      {group.tag ? group.tag.name : "untagged"}
                    </div>
                    {group.items.map((t) => (
                      <TemplateRow key={t.id} template={t} today={today} onRun={runTemplate} onDelete={removeTemplate} />
                    ))}
                  </div>
                ));
              })()
            : (filterTags.length === 0
                ? templates
                : templates.filter((t) => t.tags.some((tid) => filterTags.includes(tid)))
              ).map((t) => <TemplateRow key={t.id} template={t} today={today} onRun={runTemplate} onDelete={removeTemplate} />)}

          {templates.length === 0 && !building && (
            <div style={{ padding: "40px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>
              // no templates yet
            </div>
          )}
        </div>

        {/* Run log */}
        {runLog.length > 0 && (
          <div style={{ padding: "16px 20px 0" }}>
            <div style={{ fontSize: "10px", color: COLORS.dim, letterSpacing: "1px", marginBottom: "8px" }}>
              recent runs
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {runLog.map((r) => (
                <div key={r.id} style={{ fontSize: "11.5px", color: COLORS.dim }}>
                  <span style={{ color: COLORS.sage }}>$</span> added '{r.text}' · {r.time}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Builder panel */}
        {building && (
          <div
            style={{
              margin: "16px 16px 0",
              padding: "14px 16px",
              border: `1px solid ${COLORS.borderBright}`,
              borderRadius: "8px",
              background: COLORS.panel,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ color: COLORS.amber, fontSize: "14px", flexShrink: 0 }}>{">"}</span>
              <input
                ref={textRef}
                className="field-input"
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelBuild();
                }}
                placeholder="template task text"
              />
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              <div style={{ flex: 1 }}>
                <Toggle value={draftUrgent} onChange={setDraftUrgent} leftLabel="not urgent" rightLabel="urgent" />
              </div>
              <div style={{ flex: 1 }}>
                <Toggle
                  value={draftImportant}
                  onChange={setDraftImportant}
                  leftLabel="not important"
                  rightLabel="important"
                />
              </div>
            </div>

            <div style={{ marginBottom: draftRecurring ? "12px" : "14px" }}>
              <Toggle
                value={draftRecurring}
                onChange={setDraftRecurring}
                leftLabel="one-off"
                rightLabel="recurring"
              />
            </div>

            {draftRecurring && (
              <div
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  padding: "10px",
                  marginBottom: "14px",
                }}
              >
                <div style={{ marginBottom: "10px" }}>
                  <SegSwitch
                    value={draftFreq}
                    onChange={setDraftFreq}
                    options={[
                      { key: "daily", label: "daily" },
                      { key: "weekly", label: "weekly" },
                      { key: "monthly", label: "monthly" },
                    ]}
                  />
                </div>

                {draftFreq === "weekly" && (
                  <div style={{ display: "flex", gap: "4px" }}>
                    {DAY_LABELS.map((label, i) => {
                      const active = draftWeekDays.includes(i);
                      return (
                        <span
                          key={i}
                          className="day-chip"
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
                          }}
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {draftFreq === "monthly" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11.5px", color: COLORS.dim }}>day of month</span>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={draftMonthDay}
                      onChange={(e) => {
                        const v = Math.min(31, Math.max(1, Number(e.target.value) || 1));
                        setDraftMonthDay(v);
                      }}
                      className="field-input"
                      style={{
                        width: "56px",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: "5px",
                        padding: "5px 8px",
                        fontSize: "13px",
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
              {TAGS.map((tag) => (
                <TagPickerChip
                  key={tag.id}
                  tag={tag}
                  active={draftTags.includes(tag.id)}
                  onClick={() => toggleDraftTag(tag.id)}
                />
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={cancelBuild}
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
                onClick={saveTemplate}
                disabled={!textDraft.trim()}
                style={{
                  background: textDraft.trim() ? COLORS.amber : COLORS.border,
                  border: "none",
                  color: textDraft.trim() ? COLORS.bg : COLORS.dim,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  padding: "7px 14px",
                  borderRadius: "6px",
                  cursor: textDraft.trim() ? "pointer" : "default",
                }}
              >
                save
              </button>
            </div>
          </div>
        )}

        {/* FAB */}
        {!building && (
          <button
            className="fab"
            onClick={() => setBuilding(true)}
            style={{
              position: "fixed",
              bottom: "28px",
              right: "calc(50% - 210px + 20px)",
              width: "52px",
              height: "52px",
              borderRadius: "8px",
              background: COLORS.amber,
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 20px rgba(255,176,0,0.35), 0 4px 12px rgba(0,0,0,0.5)`,
              cursor: "pointer",
            }}
          >
            <Plus size={24} color={COLORS.bg} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
