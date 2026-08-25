import React, { useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";

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

// quadrant key: urgent-important combos
const QUADRANTS = {
  do: { label: "do now", tag: "[DO NOW]", color: COLORS.amber, urgent: true, important: true },
  schedule: { label: "schedule", tag: "[SCHEDULE]", color: COLORS.sage, urgent: false, important: true },
  delegate: { label: "delegate", tag: "[DELEGATE]", color: COLORS.amberDim, urgent: true, important: false },
  drop: { label: "drop", tag: "[DROP]", color: COLORS.dim, urgent: false, important: false },
};

function quadrantFor(urgent, important) {
  if (urgent && important) return "do";
  if (!urgent && important) return "schedule";
  if (urgent && !important) return "delegate";
  return "drop";
}

const initialTasks = [
  { id: 1, text: "Fix broken sync bug before demo", done: false, urgent: true, important: true },
  { id: 2, text: "Reply to Vincent re: onboarding doc", done: false, urgent: true, important: true },
  { id: 3, text: "Design IndexedDB schema", done: false, urgent: false, important: true },
  { id: 4, text: "Learn Airflow sensors", done: false, urgent: false, important: true },
  { id: 5, text: "Answer non-urgent Slack pings", done: false, urgent: true, important: false },
  { id: 6, text: "Clean up old branches", done: false, urgent: false, important: false },
  { id: 7, text: "Sort old screenshots", done: true, urgent: false, important: false },
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

function QuadrantPanel({ qKey, tasks, onToggle, onRemove }) {
  const q = QUADRANTS[qKey];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        border: `1px solid ${COLORS.border}`,
        borderRadius: "6px",
        background: COLORS.panel,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "8px 10px",
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "10.5px",
            fontWeight: 600,
            color: q.color,
            letterSpacing: "0.5px",
          }}
        >
          {q.tag}
        </span>
        <span style={{ fontSize: "10px", color: COLORS.dim }}>{tasks.length}</span>
      </div>
      <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        {tasks.length === 0 && (
          <div style={{ padding: "14px 10px", fontSize: "10.5px", color: COLORS.dim }}>—</div>
        )}
        {tasks.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "6px",
              padding: "8px 10px",
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            <span
              onClick={() => onToggle(t.id)}
              style={{
                fontSize: "11px",
                color: t.done ? COLORS.sage : q.color,
                flexShrink: 0,
                cursor: "pointer",
                userSelect: "none",
                paddingTop: "1px",
              }}
            >
              {t.done ? "[x]" : "[ ]"}
            </span>
            <span
              onClick={() => onToggle(t.id)}
              style={{
                fontSize: "11.5px",
                lineHeight: "1.4",
                color: t.done ? COLORS.dim : COLORS.text,
                textDecoration: t.done ? "line-through" : "none",
                flex: 1,
                cursor: "pointer",
                wordBreak: "break-word",
              }}
            >
              {t.text}
            </span>
            <span onClick={() => onRemove(t.id)} style={{ cursor: "pointer", flexShrink: 0, paddingTop: "1px" }}>
              <X size={11} color={COLORS.dim} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EisenhowerView() {
  const [tasks, setTasks] = useState(initialTasks);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [urgent, setUrgent] = useState(true);
  const [important, setImportant] = useState(true);
  const inputRef = useRef(null);
  const now = useClock();

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  const toggleTask = (id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const removeTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      setTasks((prev) => [...prev, { id: Date.now(), text: trimmed, done: false, urgent, important }]);
    }
    setDraft("");
    setAdding(false);
    setUrgent(true);
    setImportant(true);
  };

  const cancelDraft = () => {
    setDraft("");
    setAdding(false);
    setUrgent(true);
    setImportant(true);
  };

  const dateStr = now
    .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })
    .toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  const grouped = {
    do: tasks.filter((t) => quadrantFor(t.urgent, t.important) === "do"),
    schedule: tasks.filter((t) => quadrantFor(t.urgent, t.important) === "schedule"),
    delegate: tasks.filter((t) => quadrantFor(t.urgent, t.important) === "delegate"),
    drop: tasks.filter((t) => quadrantFor(t.urgent, t.important) === "drop"),
  };

  return (
    <div
      style={{
        height: "100vh",
        background: COLORS.bg,
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 2px)",
        fontFamily: "'IBM Plex Mono', monospace",
        color: COLORS.text,
        display: "flex",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .fab { transition: transform 0.12s ease; }
        .fab:active { transform: scale(0.94); }
        .field-input { background: transparent; border: none; outline: none; color: ${COLORS.text};
          font-family: 'IBM Plex Mono', monospace; font-size: 14px; caret-color: ${COLORS.amber}; width: 100%; }
        .field-input::placeholder { color: ${COLORS.dim}; opacity: 1; }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
        }}
      >
        {/* Header */}
        <div style={{ padding: "24px 20px 14px", borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", marginBottom: "6px" }}>
            {dateStr} · {timeStr}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600, color: COLORS.amber, letterSpacing: "0.5px" }}>
            ~/matrix
          </div>
        </div>

        {/* Matrix grid with axis labels */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: "14px 16px 0",
            display: "grid",
            gridTemplateColumns: "20px 1fr 1fr",
            gridTemplateRows: "18px 1fr 1fr",
            gridTemplateAreas: `
              ".        colU     colNU"
              "rowI     q_do     q_sched"
              "rowNI    q_deleg  q_drop"
            `,
            gap: "8px",
            minHeight: 0,
          }}
        >
          <div
            style={{
              gridArea: "colU",
              fontSize: "10px",
              color: COLORS.dim,
              letterSpacing: "1px",
              textAlign: "center",
              alignSelf: "center",
            }}
          >
            urgent →
          </div>
          <div
            style={{
              gridArea: "colNU",
              fontSize: "10px",
              color: COLORS.dim,
              letterSpacing: "1px",
              textAlign: "center",
              alignSelf: "center",
            }}
          >
            not urgent →
          </div>
          <div
            style={{
              gridArea: "rowI",
              fontSize: "10px",
              color: COLORS.dim,
              letterSpacing: "1px",
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              textAlign: "center",
              justifySelf: "center",
            }}
          >
            important ↑
          </div>
          <div
            style={{
              gridArea: "rowNI",
              fontSize: "10px",
              color: COLORS.dim,
              letterSpacing: "1px",
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              textAlign: "center",
              justifySelf: "center",
            }}
          >
            not important ↑
          </div>

          <div style={{ gridArea: "q_do", minHeight: 0 }}>
            <QuadrantPanel qKey="do" tasks={grouped.do} onToggle={toggleTask} onRemove={removeTask} />
          </div>
          <div style={{ gridArea: "q_sched", minHeight: 0 }}>
            <QuadrantPanel qKey="schedule" tasks={grouped.schedule} onToggle={toggleTask} onRemove={removeTask} />
          </div>
          <div style={{ gridArea: "q_deleg", minHeight: 0 }}>
            <QuadrantPanel qKey="delegate" tasks={grouped.delegate} onToggle={toggleTask} onRemove={removeTask} />
          </div>
          <div style={{ gridArea: "q_drop", minHeight: 0 }}>
            <QuadrantPanel qKey="drop" tasks={grouped.drop} onToggle={toggleTask} onRemove={removeTask} />
          </div>
        </div>

        {/* Add panel */}
        {adding && (
          <div
            style={{
              flexShrink: 0,
              padding: "14px 20px",
              borderTop: `1px solid ${COLORS.borderBright}`,
              background: COLORS.panel,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ color: COLORS.amber, fontSize: "14px", flexShrink: 0 }}>{">"}</span>
              <input
                ref={inputRef}
                className="field-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelDraft();
                  if (e.key === "Enter") commitDraft();
                }}
                placeholder="new task"
              />
            </div>
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              <div style={{ flex: 1 }}>
                <Toggle value={urgent} onChange={setUrgent} leftLabel="not urgent" rightLabel="urgent" />
              </div>
              <div style={{ flex: 1 }}>
                <Toggle value={important} onChange={setImportant} leftLabel="not important" rightLabel="important" />
              </div>
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

        {/* FAB */}
        {!adding && (
          <button
            className="fab"
            onClick={() => setAdding(true)}
            style={{
              position: "absolute",
              bottom: "24px",
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
