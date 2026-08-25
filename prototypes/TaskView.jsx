import React, { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";

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

// same quadrant model as the Eisenhower matrix view
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

const initialTasks = [
  { id: 1, text: "Set up Cloudflare Worker proxy for GitHub sync", done: false, urgent: false, important: true, tags: [1] },
  { id: 2, text: "Design IndexedDB schema for tasks", done: false, urgent: true, important: true, tags: [1] },
  { id: 3, text: "Register service worker", done: true, urgent: false, important: true, tags: [1] },
  { id: 4, text: "Write manifest.json", done: true, urgent: false, important: false, tags: [1] },
  { id: 5, text: "Sketch conflict resolution for offline edits", done: false, urgent: true, important: false, tags: [1] },
  { id: 6, text: "Dentist checkup", done: false, urgent: false, important: false, tags: [3] },
  { id: 7, text: "Renew ID card", done: false, urgent: true, important: true, tags: [4] },
  { id: 8, text: "Plan birthday gift", done: false, urgent: false, important: true, tags: [5, 2] },
];

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Checkbox({ done }) {
  return (
    <span
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        color: done ? COLORS.sage : COLORS.amber,
        fontSize: "15px",
        letterSpacing: "0.5px",
        width: "30px",
        flexShrink: 0,
        userSelect: "none",
        textShadow: done ? "none" : `0 0 8px ${COLORS.amberDim}`,
      }}
    >
      {done ? "[×]" : "[ ]"}
    </span>
  );
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

function SortSwitch({ value, onChange }) {
  const options = [
    { key: "added", label: "added" },
    { key: "priority", label: "priority" },
    { key: "tag", label: "tag" },
  ];
  return (
    <div
      style={{
        display: "flex",
        border: `1px solid ${COLORS.border}`,
        borderRadius: "6px",
        overflow: "hidden",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "10.5px",
      }}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{
              padding: "5px 9px",
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
            {o.label}
          </button>
        );
      })}
    </div>
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

export default function TaskView() {
  const [tasks, setTasks] = useState(initialTasks);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftUrgent, setDraftUrgent] = useState(false);
  const [draftImportant, setDraftImportant] = useState(false);
  const [draftTags, setDraftTags] = useState([]);
  const [sortBy, setSortBy] = useState("added");
  const [filterTags, setFilterTags] = useState([]);
  const inputRef = useRef(null);
  const now = useClock();

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  const toggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const toggleDraftTag = (id) => {
    setDraftTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleFilterTag = (id) => {
    setFilterTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      setTasks((prev) => [
        ...prev,
        { id: Date.now(), text: trimmed, done: false, urgent: draftUrgent, important: draftImportant, tags: draftTags },
      ]);
    }
    setDraft("");
    setDraftUrgent(false);
    setDraftImportant(false);
    setDraftTags([]);
    setAdding(false);
  };

  const cancelDraft = () => {
    setDraft("");
    setDraftUrgent(false);
    setDraftImportant(false);
    setDraftTags([]);
    setAdding(false);
  };

  const remaining = tasks.filter((t) => !t.done).length;
  const dateStr = now
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    })
    .toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const filteredTasks =
    filterTags.length === 0
      ? tasks
      : tasks.filter((t) => t.tags.some((tid) => filterTags.includes(tid)));

  const sortedTasks =
    sortBy === "priority"
      ? [...filteredTasks].sort((a, b) => {
          const rankA = QUADRANTS[quadrantFor(a.urgent, a.important)].rank;
          const rankB = QUADRANTS[quadrantFor(b.urgent, b.important)].rank;
          return rankA - rankB;
        })
      : filteredTasks;

  // grouped-by-tag view: each task grouped under its first tag; untagged tasks last
  let tagGroups = null;
  if (sortBy === "tag") {
    tagGroups = TAGS.map((tag) => ({
      tag,
      tasks: filteredTasks.filter((t) => t.tags[0] === tag.id),
    })).filter((g) => g.tasks.length > 0);
    const untagged = filteredTasks.filter((t) => t.tags.length === 0);
    if (untagged.length > 0) tagGroups.push({ tag: null, tasks: untagged });
  }

  const renderTaskRow = (t) => {
    const qKey = quadrantFor(t.urgent, t.important);
    const q = QUADRANTS[qKey];
    return (
      <div
        key={t.id}
        className="task-row"
        onClick={() => toggleTask(t.id)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "14px 20px 14px 16px",
          borderBottom: `1px solid ${COLORS.border}`,
          borderLeft: `3px solid ${t.done ? COLORS.border : q.color}`,
          cursor: "pointer",
        }}
      >
        <Checkbox done={t.done} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: "14.5px",
              lineHeight: "1.5",
              color: t.done ? COLORS.dim : COLORS.text,
              textDecoration: t.done ? "line-through" : "none",
              textDecorationColor: COLORS.dim,
              wordBreak: "break-word",
            }}
          >
            {t.text}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "10px",
                letterSpacing: "0.5px",
                color: t.done ? COLORS.dim : q.color,
                textTransform: "uppercase",
              }}
            >
              {q.label}
            </span>
            {t.tags.map((tid) => {
              const tag = tagById(tid);
              return tag ? <TagChip key={tid} tag={tag} small /> : null;
            })}
          </div>
        </div>
      </div>
    );
  };

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
        @keyframes blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        .cursor { animation: blink 1s step-start infinite; }
        .task-row { transition: background 0.12s ease; }
        .task-row:active { background: ${COLORS.panel}; }
        .fab { transition: transform 0.12s ease, box-shadow 0.12s ease; }
        .fab:active { transform: scale(0.94); }
        input::selection { background: ${COLORS.amberDim}; }
        .task-input::placeholder { color: ${COLORS.dim}; opacity: 1; }
        .filter-scroll { overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none; }
        .filter-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ width: "100%", maxWidth: "420px", padding: "0 0 100px 0" }}>
        {/* Header */}
        <div
          style={{
            padding: "28px 20px 16px",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: COLORS.dim,
              letterSpacing: "1px",
              marginBottom: "6px",
            }}
          >
            {dateStr} · {timeStr}
          </div>
          <div
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: COLORS.amber,
              letterSpacing: "0.5px",
            }}
          >
            ~/tasks
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "10px",
            }}
          >
            <div style={{ fontSize: "12px", color: COLORS.dim }}>
              {remaining} open · {tasks.length - remaining} done
            </div>
            <SortSwitch value={sortBy} onChange={setSortBy} />
          </div>
        </div>

        {/* Tag filter bar */}
        <div
          className="filter-scroll"
          style={{
            display: "flex",
            gap: "6px",
            padding: "10px 20px",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          {TAGS.map((tag) => (
            <TagPickerChip key={tag.id} tag={tag} active={filterTags.includes(tag.id)} onClick={() => toggleFilterTag(tag.id)} />
          ))}
        </div>

        {/* Task list */}
        <div>
          {sortBy === "tag"
            ? tagGroups.map((group) => (
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
                  {group.tasks.map(renderTaskRow)}
                </div>
              ))
            : sortedTasks.map(renderTaskRow)}

          {/* Inline add row */}
          {adding && (
            <div
              style={{
                padding: "14px 20px",
                borderBottom: `1px solid ${COLORS.borderBright}`,
                background: COLORS.panel,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span
                  style={{
                    color: COLORS.amber,
                    fontSize: "15px",
                    width: "30px",
                    flexShrink: 0,
                  }}
                >
                  {"[ ]"}
                </span>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitDraft();
                    if (e.key === "Escape") cancelDraft();
                  }}
                  placeholder="new task"
                  className="task-input"
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: COLORS.text,
                    caretColor: COLORS.amber,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "14.5px",
                    flex: 1,
                  }}
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
                  onClick={cancelDraft}
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
                  onClick={commitDraft}
                  disabled={!draft.trim()}
                  style={{
                    background: draft.trim() ? COLORS.amber : COLORS.border,
                    border: "none",
                    color: draft.trim() ? COLORS.bg : COLORS.dim,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    padding: "7px 14px",
                    borderRadius: "6px",
                    cursor: draft.trim() ? "pointer" : "default",
                  }}
                >
                  add
                </button>
              </div>
            </div>
          )}

          {tasks.length === 0 && !adding && (
            <div
              style={{
                padding: "40px 20px",
                color: COLORS.dim,
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              // no tasks logged yet
            </div>
          )}
        </div>

        {/* FAB */}
        {!adding && (
          <button
            className="fab"
            onClick={() => setAdding(true)}
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
