import { useRef, useState, useEffect } from "react";
import { Plus, X, ChevronLeft, ChevronRight, Hourglass, Flag, CalendarClock } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { QUADRANTS, quadrantFor } from "../lib/quadrant.js";
import { useClock } from "../hooks/useClock.js";
import { useTags } from "../hooks/useTags.js";
import { useTasks } from "../hooks/useTasks.js";
import { useShowCompleted } from "../hooks/useShowCompleted.js";
import { usePersistentState } from "../hooks/usePersistentState.js";
import { Toggle } from "../components/Toggle.jsx";
import { Segmented } from "../components/Segmented.jsx";
import { CompletedToggle } from "../components/CompletedToggle.jsx";
import { TaskEditModal } from "../components/TaskEditModal.jsx";
import { NAV_HEIGHT } from "../components/NavBar.jsx";
import { TOPBAR_HEIGHT } from "../components/TopBar.jsx";
import { toISO, startOfToday, startOfWeekMonday, addDays, addMonths, buildMonthGrid } from "../lib/dateUtils.js";

// A task appears on its startDate day and/or its dueDate day — see
// ARCHITECTURE.md §7 ("Start date / due date split"). Deliberately two
// separate day markers rather than a spanning bar, for simplicity.
function occurrencesForDate(tasks, iso) {
  const occurrences = [];
  for (const t of tasks) {
    const isStart = t.startDate === iso;
    const isDue = t.dueDate === iso;
    if (isStart && isDue) occurrences.push({ task: t, kind: "both" });
    else if (isStart) occurrences.push({ task: t, kind: "start" });
    else if (isDue) occurrences.push({ task: t, kind: "due" });
  }
  return occurrences;
}

function OccIcon({ kind }) {
  if (kind === "both") return <CalendarClock size={11} color={COLORS.dim} />;
  if (kind === "start") return <Hourglass size={11} color={COLORS.dim} />;
  return <Flag size={11} color={COLORS.dim} />;
}

function occLabel(kind) {
  if (kind === "both") return "starts · due";
  if (kind === "start") return "starts";
  return "due";
}

const MODE_OPTIONS = [
  { key: "list", label: "list" },
  { key: "week", label: "week" },
  { key: "month", label: "month" },
];

function buildChronologicalDays(fromDate, horizonDays, tasks) {
  const days = [];
  for (let i = 0; i < horizonDays; i++) {
    const date = addDays(fromDate, i);
    const occurrences = occurrencesForDate(tasks, toISO(date));
    if (occurrences.length > 0) days.push({ date, occurrences });
  }
  return days;
}

function TaskRow({ occ, onToggle, onEdit, onRemove }) {
  const t = occ.task;
  const q = QUADRANTS[quadrantFor(t.urgent, t.important)];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "10px 14px 10px 12px",
        borderBottom: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${t.done ? COLORS.border : q.color}`,
      }}
    >
      <span
        onClick={() => onToggle(t.id)}
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          color: t.done ? COLORS.sage : COLORS.amber,
          fontSize: "13.5px",
          width: "24px",
          flexShrink: 0,
          userSelect: "none",
          cursor: "pointer",
        }}
      >
        {t.done ? "[×]" : "[ ]"}
      </span>
      <div onClick={() => onEdit(t.id)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
        <span
          style={{
            fontSize: "13.5px",
            lineHeight: "1.5",
            color: t.done ? COLORS.dim : COLORS.text,
            textDecoration: t.done ? "line-through" : "none",
            wordBreak: "break-word",
          }}
        >
          {t.text}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
          <span style={{ fontSize: "9.5px", letterSpacing: "0.5px", color: t.done ? COLORS.dim : q.color, textTransform: "uppercase" }}>
            {q.label}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "9.5px", color: COLORS.dim }}>
            <OccIcon kind={occ.kind} />
            {occLabel(occ.kind)}
          </span>
        </div>
      </div>
      <span onClick={() => onRemove(t.id)} style={{ cursor: "pointer", flexShrink: 0, paddingTop: "2px" }}>
        <X size={13} color={COLORS.dim} />
      </span>
    </div>
  );
}

function DaySection({ date, occurrences, onToggle, onEdit, onRemove, isToday }) {
  const label = date.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
  return (
    <div style={{ marginBottom: "2px" }}>
      <div
        style={{
          padding: "8px 20px",
          fontSize: "11px",
          letterSpacing: "0.5px",
          color: isToday ? COLORS.amber : COLORS.dim,
          background: isToday ? "rgba(255,176,0,0.06)" : "transparent",
          borderBottom: `1px solid ${COLORS.border}`,
          fontWeight: isToday ? 600 : 400,
        }}
      >
        {label}
        {isToday ? " · today" : ""}
      </div>
      {occurrences.length === 0 ? (
        <div style={{ padding: "10px 20px", fontSize: "11.5px", color: COLORS.dim }}>—</div>
      ) : (
        <div style={{ padding: "0 6px" }}>
          {occurrences.map((occ) => (
            <TaskRow key={occ.task.id} occ={occ} onToggle={onToggle} onEdit={onEdit} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}

// Reads/writes the same task store as Tasks and Matrix — see ARCHITECTURE.md
// §8 point 4. Tasks with neither a startDate nor a dueDate are intentionally
// invisible here — see §7 "Calendar + unscheduled tasks". Unlike Tasks/Matrix,
// this view does NOT hide future-startDate tasks: seeing what's scheduled on
// a given day is the point of a calendar.
export default function CalendarView() {
  const { tags, loading: tagsLoading } = useTags();
  const { tasks, loading: tasksLoading, toggleTask, addTask, removeTask, updateTask } = useTasks();
  const [mode, setMode] = usePersistentState("manifest.calendar.mode", "week");
  const today = startOfToday();
  const [anchor, setAnchor] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftDueDate, setDraftDueDate] = useState(toISO(today));
  const [draftUrgent, setDraftUrgent] = useState(false);
  const [draftImportant, setDraftImportant] = useState(false);
  const [showCompleted, setShowCompleted] = useShowCompleted();
  const inputRef = useRef(null);
  const sentinelRef = useRef(null);
  const [horizonDays, setHorizonDays] = useState(90);
  const now = useClock();

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  useEffect(() => {
    if (mode !== "list") return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHorizonDays((h) => Math.min(h + 90, 730));
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode, horizonDays]);

  const visibleTasks = showCompleted ? tasks : tasks.filter((t) => !t.done);

  const editingTask = editingId ? tasks.find((t) => t.id === editingId) : null;

  const occurrencesForDay = (d) => occurrencesForDate(visibleTasks, toISO(d));

  const openAddFor = (date) => {
    setDraftDueDate(toISO(date));
    setAdding(true);
  };

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (trimmed && (draftStartDate || draftDueDate)) {
      addTask({
        text: trimmed,
        urgent: draftUrgent,
        important: draftImportant,
        tags: [],
        startDate: draftStartDate || undefined,
        dueDate: draftDueDate || undefined,
      });
    }
    setDraft("");
    setDraftUrgent(false);
    setDraftImportant(false);
    setDraftStartDate("");
    setDraftDueDate(toISO(today));
    setAdding(false);
  };

  const cancelDraft = () => {
    setDraft("");
    setDraftUrgent(false);
    setDraftImportant(false);
    setDraftStartDate("");
    setDraftDueDate(toISO(today));
    setAdding(false);
  };

  const goPrev = () => {
    if (mode === "week") setAnchor((a) => addDays(a, -7));
    else setAnchor((a) => addMonths(a, -1));
  };
  const goNext = () => {
    if (mode === "week") setAnchor((a) => addDays(a, 7));
    else setAnchor((a) => addMonths(a, 1));
  };
  const goToday = () => {
    setAnchor(today);
    setSelectedDate(today);
  };

  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  let periodLabel = "";
  let weekDays = [];
  let monthCells = [];
  let chronoDays = [];

  if (mode === "list") {
    chronoDays = buildChronologicalDays(today, horizonDays, visibleTasks);
  } else if (mode === "week") {
    const start = startOfWeekMonday(anchor);
    weekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const end = weekDays[6];
    const sameMonth = start.getMonth() === end.getMonth();
    periodLabel = sameMonth
      ? `${start.getDate()}–${end.getDate()} ${start.toLocaleDateString("en-GB", { month: "short" }).toLowerCase()}`
      : `${start.getDate()} ${start.toLocaleDateString("en-GB", { month: "short" }).toLowerCase()} – ${end.getDate()} ${end.toLocaleDateString("en-GB", { month: "short" }).toLowerCase()}`;
  } else {
    monthCells = buildMonthGrid(anchor);
    periodLabel = anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" }).toLowerCase();
  }

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
      <div style={{ width: "100%", maxWidth: "420px", padding: `${TOPBAR_HEIGHT}px 0 ${100 + NAV_HEIGHT}px 0` }}>
        {/* Header */}
        <div style={{ padding: "24px 20px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", marginBottom: "6px" }}>
            {dateStr} · {timeStr}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: 600, color: COLORS.amber, letterSpacing: "0.5px" }}>
              ~/calendar
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CompletedToggle value={showCompleted} onChange={setShowCompleted} />
              <Segmented value={mode} onChange={setMode} options={MODE_OPTIONS} />
            </div>
          </div>
        </div>

        {/* Period nav */}
        {mode !== "list" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
            <span onClick={goPrev} style={{ cursor: "pointer" }}>
              <ChevronLeft size={18} color={COLORS.dim} />
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "13px", color: COLORS.text, letterSpacing: "0.3px" }}>{periodLabel}</span>
              <button
                onClick={goToday}
                style={{
                  background: "none",
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.dim,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "10px",
                  padding: "3px 8px",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                today
              </button>
            </div>
            <span onClick={goNext} style={{ cursor: "pointer" }}>
              <ChevronRight size={18} color={COLORS.dim} />
            </span>
          </div>
        )}

        {/* List mode */}
        {mode === "list" && (
          <>
            <div style={{ padding: "10px 20px", fontSize: "11px", color: COLORS.dim, letterSpacing: "0.5px", borderBottom: `1px solid ${COLORS.border}` }}>
              upcoming · scrolling forward from today
            </div>
            {chronoDays.map((d) => (
              <DaySection key={toISO(d.date)} date={d.date} occurrences={d.occurrences} onToggle={toggleTask} onEdit={setEditingId} onRemove={removeTask} isToday={toISO(d.date) === toISO(today)} />
            ))}
            <div ref={sentinelRef} style={{ padding: "24px 20px", textAlign: "center" }}>
              {horizonDays >= 730 ? (
                <span style={{ fontSize: "11px", color: COLORS.dim }}>// nothing scheduled further out</span>
              ) : (
                <span style={{ fontSize: "11px", color: COLORS.dim }}>loading more…</span>
              )}
            </div>
          </>
        )}

        {/* Week mode */}
        {mode === "week" &&
          weekDays.map((d) => (
            <DaySection key={toISO(d)} date={d} occurrences={occurrencesForDay(d)} onToggle={toggleTask} onEdit={setEditingId} onRemove={removeTask} isToday={toISO(d) === toISO(today)} />
          ))}

        {/* Month mode */}
        {mode === "month" && (
          <>
            <div style={{ padding: "10px 16px 0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", fontSize: "9.5px", color: COLORS.dim, textAlign: "center", marginBottom: "4px", letterSpacing: "0.5px" }}>
                {["mo", "tu", "we", "th", "fr", "sa", "su"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px" }}>
                {monthCells.map((cell) => {
                  const iso = toISO(cell.date);
                  const dayOccurrences = occurrencesForDay(cell.date);
                  const isToday = iso === toISO(today);
                  const isSelected = iso === toISO(selectedDate);
                  return (
                    <div
                      key={iso}
                      onClick={() => {
                        setSelectedDate(cell.date);
                        if (!cell.inMonth) setAnchor(cell.date);
                      }}
                      style={{
                        aspectRatio: "1",
                        borderRadius: "6px",
                        border: `1px solid ${isSelected ? COLORS.amber : COLORS.border}`,
                        background: isSelected ? "rgba(255,176,0,0.10)" : "transparent",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "3px",
                        padding: "2px",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: "12px", color: !cell.inMonth ? COLORS.border : isToday ? COLORS.amber : COLORS.text, fontWeight: isToday ? 600 : 400 }}>
                        {cell.date.getDate()}
                      </span>
                      <div style={{ display: "flex", gap: "2px", height: "5px" }}>
                        {dayOccurrences.slice(0, 3).map((occ) => {
                          const q = QUADRANTS[quadrantFor(occ.task.urgent, occ.task.important)];
                          return <span key={occ.task.id} style={{ width: "4px", height: "4px", borderRadius: "50%", background: occ.task.done ? COLORS.border : q.color }} />;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: "16px" }}>
              <DaySection date={selectedDate} occurrences={occurrencesForDay(selectedDate)} onToggle={toggleTask} onEdit={setEditingId} onRemove={removeTask} isToday={toISO(selectedDate) === toISO(today)} />
            </div>
          </>
        )}

        {/* Add panel */}
        {adding && (
          <div style={{ padding: "14px 20px", borderTop: `1px solid ${COLORS.borderBright}`, borderBottom: `1px solid ${COLORS.borderBright}`, background: COLORS.panel, marginTop: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <span style={{ color: COLORS.amber, fontSize: "14px", flexShrink: 0 }}>{">"}</span>
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelDraft();
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
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px", border: `1px solid ${COLORS.border}`, borderRadius: "6px", padding: "0 8px" }}>
                <Hourglass size={12} color={COLORS.dim} />
                <input
                  type="date"
                  value={draftStartDate}
                  onChange={(e) => setDraftStartDate(e.target.value)}
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: COLORS.text,
                    caretColor: COLORS.amber,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "13px",
                    colorScheme: "dark",
                    accentColor: COLORS.amber,
                    flex: 1,
                    minWidth: 0,
                    padding: "6px 0",
                  }}
                />
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px", border: `1px solid ${COLORS.border}`, borderRadius: "6px", padding: "0 8px" }}>
                <Flag size={12} color={COLORS.dim} />
                <input
                  type="date"
                  value={draftDueDate}
                  onChange={(e) => setDraftDueDate(e.target.value)}
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: COLORS.text,
                    caretColor: COLORS.amber,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "13px",
                    colorScheme: "dark",
                    accentColor: COLORS.amber,
                    flex: 1,
                    minWidth: 0,
                    padding: "6px 0",
                  }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              <div style={{ flex: 1 }}>
                <Toggle value={draftUrgent} onChange={setDraftUrgent} leftLabel="not urgent" rightLabel="urgent" />
              </div>
              <div style={{ flex: 1 }}>
                <Toggle value={draftImportant} onChange={setDraftImportant} leftLabel="not important" rightLabel="important" />
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
            onClick={() => openAddFor(mode === "month" ? selectedDate : today)}
            style={{
              position: "fixed",
              bottom: `${28 + NAV_HEIGHT}px`,
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

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          tags={tags}
          onClose={() => setEditingId(null)}
          onSave={(updates) => {
            updateTask(editingTask.id, updates);
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}
