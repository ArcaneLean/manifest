import { useRef, useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { QUADRANTS, quadrantFor } from "../lib/quadrant.js";
import { isScheduled } from "../lib/taskDates.js";
import { toISO } from "../lib/dateUtils.js";
import { useClock } from "../hooks/useClock.js";
import { useTags } from "../hooks/useTags.js";
import { useTasks } from "../hooks/useTasks.js";
import { useShowCompleted } from "../hooks/useShowCompleted.js";
import { useShowScheduled } from "../hooks/useShowScheduled.js";
import { Toggle } from "../components/Toggle.jsx";
import { CompletedToggle } from "../components/CompletedToggle.jsx";
import { ScheduledToggle } from "../components/ScheduledToggle.jsx";
import { NAV_HEIGHT } from "../components/NavBar.jsx";

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
        <span style={{ fontSize: "10.5px", fontWeight: 600, color: q.color, letterSpacing: "0.5px" }}>
          [{q.label.toUpperCase()}]
        </span>
        <span style={{ fontSize: "10px", color: COLORS.dim }}>{tasks.length}</span>
      </div>
      <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        {tasks.length === 0 && <div style={{ padding: "14px 10px", fontSize: "10.5px", color: COLORS.dim }}>—</div>}
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

// Lens over the same task store Tasks writes — see ARCHITECTURE.md §5
// ("2x2 lens over the same task store, not separate data").
export default function MatrixView() {
  const { tags, loading: tagsLoading } = useTags();
  const { tasks, loading: tasksLoading, toggleTask, addTask, removeTask } = useTasks();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [urgent, setUrgent] = useState(true);
  const [important, setImportant] = useState(true);
  const [showCompleted, setShowCompleted] = useShowCompleted();
  const [showScheduled, setShowScheduled] = useShowScheduled();
  const inputRef = useRef(null);
  const now = useClock();

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      addTask({ text: trimmed, urgent, important, tags: [] });
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

  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  const todayISO = toISO(now);
  const visibleTasks = tasks.filter(
    (t) => (showCompleted || !t.done) && (showScheduled || !isScheduled(t, todayISO))
  );

  const grouped = {
    do: visibleTasks.filter((t) => quadrantFor(t.urgent, t.important) === "do"),
    schedule: visibleTasks.filter((t) => quadrantFor(t.urgent, t.important) === "schedule"),
    delegate: visibleTasks.filter((t) => quadrantFor(t.urgent, t.important) === "delegate"),
    drop: visibleTasks.filter((t) => quadrantFor(t.urgent, t.important) === "drop"),
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
      <div style={{ width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", height: "100vh" }}>
        {/* Header */}
        <div style={{ padding: "24px 20px 14px", borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", marginBottom: "6px" }}>
            {dateStr} · {timeStr}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: "20px", fontWeight: 600, color: COLORS.amber, letterSpacing: "0.5px" }}>
              ~/matrix
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CompletedToggle value={showCompleted} onChange={setShowCompleted} />
              <ScheduledToggle value={showScheduled} onChange={setShowScheduled} />
            </div>
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
          }}
        >
          <div style={{ gridArea: "colU", fontSize: "10px", color: COLORS.dim, letterSpacing: "1px", textAlign: "center", alignSelf: "center" }}>
            urgent →
          </div>
          <div style={{ gridArea: "colNU", fontSize: "10px", color: COLORS.dim, letterSpacing: "1px", textAlign: "center", alignSelf: "center" }}>
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
          <div style={{ flexShrink: 0, padding: "14px 20px", borderTop: `1px solid ${COLORS.borderBright}`, background: COLORS.panel }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ color: COLORS.amber, fontSize: "14px", flexShrink: 0 }}>{">"}</span>
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelDraft();
                  if (e.key === "Enter") commitDraft();
                }}
                placeholder="new task"
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: COLORS.text,
                  caretColor: COLORS.amber,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "14px",
                  flex: 1,
                }}
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

        {/* clears the nav bar without letting the grid's flex:1 collapse under it */}
        <div style={{ flexShrink: 0, height: `${NAV_HEIGHT}px` }} />

        {/* FAB */}
        {!adding && (
          <button
            className="fab"
            onClick={() => setAdding(true)}
            style={{
              position: "fixed",
              bottom: `${24 + NAV_HEIGHT}px`,
              right: "calc(50% - 210px + 20px)",
              width: "52px",
              height: "52px",
              borderRadius: "8px",
              background: COLORS.amber,
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 20px rgba(255,176,0,0.35), 0 4px 12px rgba(0,0,0,0.5)",
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
