import { useRef, useState, useEffect } from "react";
import { Plus, X, ChevronLeft, ChevronRight, Hourglass, Flag, CalendarClock, Repeat, Cloud } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { QUADRANTS, quadrantFor } from "../lib/quadrant.js";
import { useClock } from "../hooks/useClock.js";
import { useTags } from "../hooks/useTags.js";
import { useTasks } from "../hooks/useTasks.js";
import { useTemplates } from "../hooks/useTemplates.js";
import { useShowCompleted } from "../hooks/useShowCompleted.js";
import { usePersistentState } from "../hooks/usePersistentState.js";
import { useGoogleCalendar } from "../hooks/useGoogleCalendar.js";
import { Toggle } from "../components/Toggle.jsx";
import { Segmented } from "../components/Segmented.jsx";
import { CompletedToggle } from "../components/CompletedToggle.jsx";
import { GoogleCalendarButton } from "../components/GoogleCalendarButton.jsx";
import { TaskEditModal } from "../components/TaskEditModal.jsx";
import { TemplateEditModal } from "../components/TemplateEditModal.jsx";
import { NAV_HEIGHT } from "../components/NavBar.jsx";
import { TOPBAR_HEIGHT } from "../components/TopBar.jsx";
import { toISO, parseISODate, startOfToday, startOfWeekMonday, addDays, addMonths, buildMonthGrid } from "../lib/dateUtils.js";
import { occurrencesInRange } from "../lib/recurrence.js";

// Deliberately outside both the quadrant palette and TAG_PALETTE (see
// ARCHITECTURE.md §3) — Google Calendar events are a third, external
// coding system and shouldn't be visually confused with either.
const GCAL_COLOR = "#6b8fb5";

// Expands one Google Calendar event into the ISO day(s) it should render
// on. All-day events use Google's [start.date, end.date) — end exclusive;
// timed events are shown on every local calendar day they touch. Guarded
// against runaway loops on malformed data — the sync's own 2-year window
// (googleCalendarSync.js) keeps real spans far shorter than the guard.
function datesForGCalEvent(event) {
  if (!event.start || !event.end) return [];
  // All-day: start/end are "YYYY-MM-DD" strings, end exclusive per the
  // Google Calendar API. Timed: start/end are datetimes — shown on every
  // local calendar day they touch, end inclusive.
  const firstDay = event.allDay ? parseISODate(event.start) : parseISODate(toISO(new Date(event.start)));
  const lastDay = event.allDay ? addDays(parseISODate(event.end), -1) : parseISODate(toISO(new Date(event.end)));
  const dates = [];
  let cur = firstDay;
  let guard = 0;
  while (cur <= lastDay && guard < 400) {
    dates.push(toISO(cur));
    cur = addDays(cur, 1);
    guard++;
  }
  return dates;
}

// Returns Map<iso, GCalEvent[]> for whichever events fall in range — mirrors
// virtualOccurrencesInRange below, recomputed fresh per render.
function gcalEventsByDate(events) {
  const byDate = new Map();
  for (const event of events) {
    for (const iso of datesForGCalEvent(event)) {
      if (!byDate.has(iso)) byDate.set(iso, []);
      byDate.get(iso).push(event);
    }
  }
  return byDate;
}

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

// Projected occurrences for recurring templates, beyond each template's one
// real "anchor" task — see ARCHITECTURE.md §7. Computed fresh per render for
// whatever date range is currently visible; nothing here is persisted.
// Returns a Map<iso, Template[]>.
function virtualOccurrencesInRange(templates, tasks, rangeStart, rangeEnd) {
  const byDate = new Map();
  for (const template of templates) {
    if (!template.recurring) continue;
    const anchor = tasks.find((t) => t.templateId === template.id && !t.done);
    const anchorDateISO = anchor?.dueDate || anchor?.startDate;
    if (!anchorDateISO) continue;
    const dates = occurrencesInRange(template.recurring, parseISODate(anchorDateISO), rangeEnd);
    for (const d of dates) {
      if (d < rangeStart) continue;
      const iso = toISO(d);
      if (!byDate.has(iso)) byDate.set(iso, []);
      byDate.get(iso).push(template);
    }
  }
  return byDate;
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

function buildChronologicalDays(fromDate, horizonDays, tasks, virtualByDate, gcalByDate) {
  const days = [];
  for (let i = 0; i < horizonDays; i++) {
    const date = addDays(fromDate, i);
    const iso = toISO(date);
    const occurrences = occurrencesForDate(tasks, iso);
    const virtualTemplates = virtualByDate.get(iso) || [];
    const gcalEvents = gcalByDate.get(iso) || [];
    if (occurrences.length > 0 || virtualTemplates.length > 0 || gcalEvents.length > 0) {
      days.push({ date, occurrences, virtualTemplates, gcalEvents });
    }
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

// A projected occurrence of a recurring template — not a real, completable
// task. Tapping it edits the template itself rather than one occurrence
// (see ARCHITECTURE.md §7), so there's no checkbox and no delete.
function VirtualOccRow({ template, onEditTemplate }) {
  const q = QUADRANTS[quadrantFor(template.urgent, template.important)];
  return (
    <div
      onClick={() => onEditTemplate(template.id)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "10px 14px 10px 12px",
        borderBottom: `1px solid ${COLORS.border}`,
        borderLeft: `3px dashed ${q.color}`,
        cursor: "pointer",
        opacity: 0.7,
      }}
    >
      <span style={{ width: "24px", flexShrink: 0, display: "flex", justifyContent: "center" }}>
        <Repeat size={12} color={COLORS.dim} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: "13.5px", lineHeight: "1.5", color: COLORS.text, wordBreak: "break-word" }}>
          {template.text}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
          <span style={{ fontSize: "9.5px", letterSpacing: "0.5px", color: q.color, textTransform: "uppercase" }}>
            {q.label}
          </span>
          <span style={{ fontSize: "9.5px", color: COLORS.dim }}>recurring</span>
        </div>
      </div>
    </div>
  );
}

// A read-only Google Calendar event — see ARCHITECTURE.md §7 ("Google
// Calendar integration"). No checkbox, no edit/delete; tapping opens the
// event on calendar.google.com instead, since this app is never the source
// of truth for it.
function GCalEventRow({ event }) {
  const timeLabel = event.allDay
    ? null
    : new Date(event.start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return (
    <div
      onClick={() => event.htmlLink && window.open(event.htmlLink, "_blank", "noopener,noreferrer")}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "10px 14px 10px 12px",
        borderBottom: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${GCAL_COLOR}`,
        cursor: event.htmlLink ? "pointer" : "default",
        opacity: 0.85,
      }}
    >
      <span style={{ width: "24px", flexShrink: 0, display: "flex", justifyContent: "center" }}>
        <Cloud size={12} color={COLORS.dim} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: "13.5px", lineHeight: "1.5", color: COLORS.text, wordBreak: "break-word" }}>
          {event.summary}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
          <span style={{ fontSize: "9.5px", letterSpacing: "0.5px", color: GCAL_COLOR, textTransform: "uppercase" }}>
            google calendar
          </span>
          {timeLabel && <span style={{ fontSize: "9.5px", color: COLORS.dim }}>{timeLabel}</span>}
        </div>
      </div>
    </div>
  );
}

function DaySection({ date, occurrences, virtualTemplates = [], gcalEvents = [], onToggle, onEdit, onRemove, onEditTemplate, isToday }) {
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
      {occurrences.length === 0 && virtualTemplates.length === 0 && gcalEvents.length === 0 ? (
        <div style={{ padding: "10px 20px", fontSize: "11.5px", color: COLORS.dim }}>—</div>
      ) : (
        <div style={{ padding: "0 6px" }}>
          {occurrences.map((occ) => (
            <TaskRow key={occ.task.id} occ={occ} onToggle={onToggle} onEdit={onEdit} onRemove={onRemove} />
          ))}
          {virtualTemplates.map((template) => (
            <VirtualOccRow key={template.id} template={template} onEditTemplate={onEditTemplate} />
          ))}
          {gcalEvents.map((event) => (
            <GCalEventRow key={event.key} event={event} />
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
  const { templates, loading: templatesLoading, updateTemplate } = useTemplates();
  const gcal = useGoogleCalendar();
  const [mode, setMode] = usePersistentState("manifest.calendar.mode", "week");
  const today = startOfToday();
  const [anchor, setAnchor] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
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
  const editingTemplate = editingTemplateId ? templates.find((t) => t.id === editingTemplateId) : null;

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
  let rangeStart = today;
  let rangeEnd = today;

  if (mode === "list") {
    rangeEnd = addDays(today, horizonDays);
  } else if (mode === "week") {
    const start = startOfWeekMonday(anchor);
    weekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const end = weekDays[6];
    rangeStart = start;
    rangeEnd = end;
    const sameMonth = start.getMonth() === end.getMonth();
    periodLabel = sameMonth
      ? `${start.getDate()}–${end.getDate()} ${start.toLocaleDateString("en-GB", { month: "short" }).toLowerCase()}`
      : `${start.getDate()} ${start.toLocaleDateString("en-GB", { month: "short" }).toLowerCase()} – ${end.getDate()} ${end.toLocaleDateString("en-GB", { month: "short" }).toLowerCase()}`;
  } else {
    monthCells = buildMonthGrid(anchor);
    rangeStart = monthCells[0].date;
    rangeEnd = monthCells[monthCells.length - 1].date;
    periodLabel = anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" }).toLowerCase();
  }

  // Virtual (projected) recurring occurrences for whatever range is on
  // screen — recomputed per render, never persisted. Keyed off the full
  // `tasks` list (not the completed-filtered `visibleTasks`) since finding
  // each template's anchor task needs the real done/not-done state.
  const virtualByDate = virtualOccurrencesInRange(templates, tasks, rangeStart, rangeEnd);
  const gcalByDate = gcalEventsByDate(gcal.events);
  const chronoDays = mode === "list" ? buildChronologicalDays(today, horizonDays, visibleTasks, virtualByDate, gcalByDate) : [];

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
              <GoogleCalendarButton
                configured={gcal.configured}
                connected={gcal.connected}
                visible={gcal.visible}
                status={gcal.status}
                error={gcal.error}
                onConnect={gcal.connect}
                onToggleVisible={gcal.toggleVisible}
                onDisconnect={gcal.disconnect}
              />
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
              <DaySection key={toISO(d.date)} date={d.date} occurrences={d.occurrences} virtualTemplates={d.virtualTemplates} gcalEvents={d.gcalEvents} onToggle={toggleTask} onEdit={setEditingId} onRemove={removeTask} onEditTemplate={setEditingTemplateId} isToday={toISO(d.date) === toISO(today)} />
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
            <DaySection key={toISO(d)} date={d} occurrences={occurrencesForDay(d)} virtualTemplates={virtualByDate.get(toISO(d)) || []} gcalEvents={gcalByDate.get(toISO(d)) || []} onToggle={toggleTask} onEdit={setEditingId} onRemove={removeTask} onEditTemplate={setEditingTemplateId} isToday={toISO(d) === toISO(today)} />
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
                  const dayVirtual = virtualByDate.get(iso) || [];
                  const dayGcal = gcalByDate.get(iso) || [];
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
                        {dayVirtual.slice(0, Math.max(0, 3 - dayOccurrences.length)).map((template) => {
                          const q = QUADRANTS[quadrantFor(template.urgent, template.important)];
                          return <span key={template.id} style={{ width: "4px", height: "4px", borderRadius: "50%", border: `1px solid ${q.color}` }} />;
                        })}
                        {dayGcal.slice(0, Math.max(0, 3 - dayOccurrences.length - dayVirtual.length)).map((event) => (
                          <span key={event.key} style={{ width: "4px", height: "4px", borderRadius: "50%", background: GCAL_COLOR }} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: "16px" }}>
              <DaySection date={selectedDate} occurrences={occurrencesForDay(selectedDate)} virtualTemplates={virtualByDate.get(toISO(selectedDate)) || []} gcalEvents={gcalByDate.get(toISO(selectedDate)) || []} onToggle={toggleTask} onEdit={setEditingId} onRemove={removeTask} onEditTemplate={setEditingTemplateId} isToday={toISO(selectedDate) === toISO(today)} />
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

      {editingTemplate && (
        <TemplateEditModal
          template={editingTemplate}
          tags={tags}
          onClose={() => setEditingTemplateId(null)}
          onSave={(updates) => {
            updateTemplate(editingTemplate.id, updates);
            setEditingTemplateId(null);
          }}
        />
      )}
    </div>
  );
}
