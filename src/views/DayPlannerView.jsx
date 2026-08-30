import { useState } from "react";
import { Cog, Cloud, Flame, ChevronLeft, ChevronRight } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { Checkbox } from "../components/Checkbox.jsx";
import { DayShapeEditModal } from "../components/DayShapeEditModal.jsx";
import { QUADRANTS, quadrantFor } from "../lib/quadrant.js";
import { toISO, startOfToday, addDays, daysBetween } from "../lib/dateUtils.js";
import {
  buildDayPlan,
  gcalBlockForDate,
  isTaskForDate,
  isHabitLoggedOnDate,
  minutesToClock,
  formatDuration,
  nowMinutes,
} from "../lib/dayPlan.js";
import { useClock } from "../hooks/useClock.js";
import { useTasks } from "../hooks/useTasks.js";
import { useHabits } from "../hooks/useHabits.js";
import { useDayShapes } from "../hooks/useDayShapes.js";
import { useGoogleCalendar } from "../hooks/useGoogleCalendar.js";
import { TOPBAR_HEIGHT } from "../components/TopBar.jsx";

const GCAL_COLOR = "#6b8fb5"; // matches CalendarView.jsx's GCAL_COLOR exactly

function timeCol(startMin, durationLabel) {
  return (
    <div style={{ width: "56px", flexShrink: 0 }}>
      <div style={{ fontSize: "12px", color: COLORS.text }}>{startMin == null ? "—" : minutesToClock(startMin)}</div>
      <div style={{ fontSize: "9.5px", color: COLORS.dim, marginTop: "1px" }}>{durationLabel}</div>
    </div>
  );
}

function FixedRow({ block }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 20px", borderBottom: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.borderBright}` }}>
      {timeCol(block.startMin, formatDuration(block.endMin - block.startMin))}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12.5px", color: COLORS.text }}>{block.label || "untitled block"}</div>
        <div style={{ fontSize: "9px", letterSpacing: "0.5px", textTransform: "uppercase", color: COLORS.dim, marginTop: "2px" }}>fixed · day shape</div>
      </div>
    </div>
  );
}

function GCalRow({ block }) {
  return (
    <a
      href={block.htmlLink}
      target="_blank"
      rel="noreferrer"
      style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 20px", borderBottom: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${GCAL_COLOR}`, textDecoration: "none" }}
    >
      {timeCol(block.allDay ? null : block.startMin, block.allDay ? "all day" : formatDuration(block.endMin - block.startMin))}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12.5px", color: COLORS.text }}>{block.label}</div>
        <div style={{ fontSize: "9px", letterSpacing: "0.5px", textTransform: "uppercase", color: GCAL_COLOR, marginTop: "2px" }}>google calendar</div>
      </div>
      <Cloud size={13} color={GCAL_COLOR} strokeWidth={1.75} />
    </a>
  );
}

function ItemRow({ item, onToggle, interactive }) {
  const isHabit = item.kind === "habit";
  const stripe = isHabit ? COLORS.sage : item.done ? COLORS.border : item.quadrant.color;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 20px", borderBottom: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${stripe}` }}>
      {timeCol(item.startMin, item.startMin == null ? "" : formatDuration(item.durationMin))}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12.5px", color: item.done ? COLORS.dim : COLORS.text }}>{item.label}</div>
        <div style={{ fontSize: "9px", letterSpacing: "0.5px", textTransform: "uppercase", color: isHabit ? COLORS.sage : item.quadrant.color, marginTop: "2px" }}>
          {isHabit ? "habit" : item.quadrant.label}
          {item.squeezed ? " · squeezed in" : ""}
        </div>
      </div>
      {isHabit && <Flame size={12} color={COLORS.sage} strokeWidth={1.75} />}
      <span onClick={interactive ? onToggle : undefined} style={{ cursor: interactive ? "pointer" : "default", opacity: interactive ? 1 : 0.5 }}>
        <Checkbox done={item.done} />
      </span>
    </div>
  );
}

function NowDivider({ nowMin }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 20px" }}>
      <div style={{ flex: 1, height: "1px", background: COLORS.amber, boxShadow: `0 0 6px ${COLORS.amber}` }} />
      <span style={{ fontSize: "10px", color: COLORS.amber, letterSpacing: "0.5px", textShadow: `0 0 6px ${COLORS.amberDim}` }}>now · {minutesToClock(nowMin)}</span>
      <div style={{ flex: 1, height: "1px", background: COLORS.amber, boxShadow: `0 0 6px ${COLORS.amber}` }} />
    </div>
  );
}

function OverflowRow({ item, squeezed, onSqueeze, onDefer, deferLabel }) {
  const isHabit = item.kind === "habit";
  const stripe = isHabit ? COLORS.sage : item.quadrant.color;
  return (
    <div style={{ padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${stripe}` }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ fontSize: "12.5px", color: COLORS.text }}>{item.label}</span>
        <span style={{ fontSize: "10px", color: COLORS.dim }}>{formatDuration(item.durationMin)}</span>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <span
          onClick={onSqueeze}
          style={{ fontSize: "9.5px", padding: "3px 9px", borderRadius: "5px", border: `1px solid ${squeezed ? COLORS.amber : COLORS.border}`, color: squeezed ? COLORS.amber : COLORS.dim, cursor: "pointer" }}
        >
          {squeezed ? "squeezed in" : "squeeze in"}
        </span>
        {!isHabit && (
          <span onClick={onDefer} style={{ fontSize: "9.5px", padding: "3px 9px", borderRadius: "5px", border: `1px solid ${COLORS.border}`, color: COLORS.dim, cursor: "pointer" }}>
            {deferLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export default function DayPlannerView() {
  const now = useClock();
  const { tasks, loading: tasksLoading, toggleTask, updateTask } = useTasks();
  const { habits, entries, loading: habitsLoading, logEntry, removeEntry } = useHabits();
  const { dayShapes, addDayShape, updateDayShape, removeDayShape, setOverrideForDate, dayShapeForDate, loading: shapesLoading } = useDayShapes();
  const gcal = useGoogleCalendar();
  const [squeezeIds, setSqueezeIds] = useState(new Set());
  const [managingShapes, setManagingShapes] = useState(false);
  const [selectedDate, setSelectedDate] = useState(startOfToday());

  const todayDate = startOfToday();
  const dayOffset = daysBetween(todayDate, selectedDate);
  const isToday = dayOffset === 0;

  const selectedISO = toISO(selectedDate);
  const dayStartMs = selectedDate.getTime();
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
  const weekday = (selectedDate.getDay() + 6) % 7; // 0=Mon..6=Sun, matches recurrence.js

  const selectedShape = dayShapeForDate(selectedISO, weekday);

  const tasksForDay = tasks.filter((t) => isTaskForDate(t, selectedISO, dayStartMs, dayEndMs));
  // Habits have no due-date/frequency concept of their own (see
  // ARCHITECTURE.md §5 — the Habits app is a plain event log), so any
  // positive habit with an estimate set is treated as "on the plan every
  // day" until logged; negative ("cutting down on") habits aren't something
  // you schedule time for, so they're excluded here.
  const habitsForPlan = habits
    .filter((h) => h.type !== "negative" && h.estimatedMinutes)
    .map((h) => ({ id: h.id, name: h.name, estimatedMinutes: h.estimatedMinutes, done: isHabitLoggedOnDate(entries, h.id, dayStartMs, dayEndMs) }));

  const plan = buildDayPlan({ dayShape: selectedShape, tasks: tasksForDay, habits: habitsForPlan, squeezeIds });

  const gcalForDay = gcal.events.map((e) => gcalBlockForDate(e, selectedISO)).filter(Boolean);
  const timedGcal = gcalForDay.filter((g) => !g.allDay);
  const allDayGcal = gcalForDay.filter((g) => g.allDay);

  const timedItems = plan.scheduled.filter((s) => s.startMin != null);
  const doneItems = plan.scheduled.filter((s) => s.startMin == null);

  const merged = [...plan.fixed, ...timedGcal, ...timedItems].sort((a, b) => a.startMin - b.startMin);
  const nowMin = nowMinutes(now);
  let dividerInserted = !isToday;

  const toggleSqueeze = (kind, id) => {
    setSqueezeIds((prev) => {
      const key = `${kind}:${id}`;
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Marking something done stamps the real current time (`toggleTask`,
  // `logEntry`) — meaningful for today, but not for a day being planned
  // ahead of or behind it — so the checkbox is read-only off today (see
  // ItemRow's `interactive` prop).
  const toggleHabitDone = (habitId, done) => {
    if (done) {
      const todays = entries.filter((e) => e.habitId === habitId && e.ts >= dayStartMs && e.ts < dayEndMs);
      const latest = todays.reduce((max, e) => (e.ts > (max?.ts ?? 0) ? e : max), null);
      if (latest) removeEntry(latest.id);
    } else {
      logEntry(habitId);
    }
  };

  const deferTaskForward = (taskId) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    const nextISO = toISO(addDays(selectedDate, 1));
    const patch = {};
    if (t.dueDate) patch.dueDate = nextISO;
    if (t.startDate) patch.startDate = nextISO;
    if (!t.dueDate && !t.startDate) patch.startDate = nextISO;
    updateTask(taskId, patch);
  };

  const goPrevDay = () => setSelectedDate((d) => addDays(d, -1));
  const goNextDay = () => setSelectedDate((d) => addDays(d, 1));
  const goToday = () => setSelectedDate(todayDate);

  const loading = tasksLoading || habitsLoading || shapesLoading;
  const met = plan.freeMin >= 0 && plan.totalDiscretionaryMin > 0 && plan.freeMin / plan.totalDiscretionaryMin >= 0.25;
  const overbooked = plan.freeMin < 0;
  const freeColor = overbooked ? COLORS.danger : met ? COLORS.sage : COLORS.amber;
  const segments = 20;
  const filledFrac = plan.totalDiscretionaryMin > 0 ? Math.min(1, plan.usedMin / plan.totalDiscretionaryMin) : 0;
  const filled = Math.round(filledFrac * segments);

  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  const selectedDateStr = selectedDate.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
  const relativeLabel = dayOffset === 0 ? "today" : dayOffset === 1 ? "tomorrow" : dayOffset === -1 ? "yesterday" : null;
  const dayLabel = relativeLabel ? `${relativeLabel} · ${selectedDateStr}` : selectedDateStr;
  const planLabel = dayOffset === 0 ? "today's plan" : dayOffset === 1 ? "tomorrow's plan" : `plan for ${selectedDateStr}`;
  const deferLabel = dayOffset === -1 ? "defer → today" : dayOffset === 0 ? "defer → tomorrow" : "defer → next day";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 2px)",
        fontFamily: "'IBM Plex Mono', monospace",
        color: COLORS.text,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px", padding: `${TOPBAR_HEIGHT}px 0 60px 0` }}>
        <div style={{ padding: "28px 20px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", marginBottom: "6px" }}>
            {dateStr} · {timeStr}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600, color: COLORS.amber, letterSpacing: "0.5px" }}>~/planner</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <span onClick={goPrevDay} style={{ cursor: "pointer", display: "flex" }} aria-label="previous day">
            <ChevronLeft size={18} color={COLORS.dim} />
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "13px", color: COLORS.text, letterSpacing: "0.3px" }}>{dayLabel}</span>
            {!isToday && (
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
            )}
          </div>
          <span onClick={goNextDay} style={{ cursor: "pointer", display: "flex" }} aria-label="next day">
            <ChevronRight size={18} color={COLORS.dim} />
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap" }}>
          <span style={{ fontSize: "10.5px", color: COLORS.dim }}>day:</span>
          {dayShapes.length === 0 && !shapesLoading && <span style={{ fontSize: "10.5px", color: COLORS.dim }}>none set up yet</span>}
          {dayShapes.map((s) => (
            <span
              key={s.id}
              onClick={() => setOverrideForDate(selectedISO, s.id)}
              style={{
                fontSize: "9.5px",
                padding: "3px 9px",
                borderRadius: "5px",
                border: `1px solid ${selectedShape?.id === s.id ? COLORS.amber : COLORS.border}`,
                color: selectedShape?.id === s.id ? COLORS.amber : COLORS.dim,
                cursor: "pointer",
              }}
            >
              {s.name}
            </span>
          ))}
          <span onClick={() => setManagingShapes(true)} style={{ cursor: "pointer", marginLeft: "auto", display: "flex" }} aria-label="manage day shapes">
            <Cog size={14} color={COLORS.dim} strokeWidth={1.75} />
          </span>
        </div>

        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
            <span style={{ fontSize: "22px", fontWeight: 600, color: freeColor }}>
              {loading ? "—" : overbooked ? `+${formatDuration(-plan.freeMin)} over` : formatDuration(plan.freeMin)}
              {!overbooked && <span style={{ fontSize: "12.5px", color: COLORS.dim, fontWeight: 400 }}> free</span>}
            </span>
            <span style={{ fontSize: "11px", color: COLORS.dim }}>of {formatDuration(plan.totalDiscretionaryMin)} discretionary</span>
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", letterSpacing: "-1px", color: freeColor, lineHeight: 1, wordBreak: "break-all", textShadow: `0 0 6px ${freeColor}55`, marginTop: "8px" }}>
            {"█".repeat(filled)}
            <span style={{ color: COLORS.border }}>{"░".repeat(segments - filled)}</span>
          </div>
          {plan.overflow.length > 0 && (
            <div style={{ fontSize: "10.5px", color: COLORS.dim, marginTop: "8px" }}>
              {plan.overflow.length} {plan.overflow.length === 1 ? "item" : "items"} didn't fit — see overflow below
            </div>
          )}
        </div>

        {!selectedShape && dayShapes.length > 0 && (
          <div style={{ padding: "10px 20px", fontSize: "11px", color: COLORS.dim, borderBottom: `1px solid ${COLORS.border}` }}>
            no day shape picked for this day — tap one above
          </div>
        )}

        <div style={{ padding: "10px 20px", fontSize: "10.5px", color: COLORS.dim, letterSpacing: "1px", textTransform: "uppercase", borderBottom: `1px solid ${COLORS.border}` }}>
          {planLabel}
        </div>

        {allDayGcal.map((g, i) => (
          <GCalRow key={`allday-${i}`} block={g} />
        ))}

        {merged.map((row, i) => {
          const showDivider = isToday && !dividerInserted && row.startMin > nowMin;
          if (showDivider) dividerInserted = true;
          const el =
            row.kind === "fixed" ? (
              <FixedRow key={`fixed-${i}`} block={row} />
            ) : row.kind === "gcal" ? (
              <GCalRow key={`gcal-${i}`} block={row} />
            ) : (
              <ItemRow
                key={`${row.kind}-${row.id}`}
                item={row}
                interactive={isToday}
                onToggle={() => (row.kind === "habit" ? toggleHabitDone(row.id, row.done) : toggleTask(row.id))}
              />
            );
          return showDivider ? (
            <div key={`wrap-${i}`}>
              <NowDivider nowMin={nowMin} />
              {el}
            </div>
          ) : (
            el
          );
        })}
        {isToday && !dividerInserted && merged.length > 0 && <NowDivider nowMin={nowMin} />}

        {doneItems.length > 0 && (
          <>
            <div style={{ padding: "8px 20px", fontSize: "9.5px", color: COLORS.dim, letterSpacing: "1px", textTransform: "uppercase" }}>{isToday ? "done today" : "done"}</div>
            {doneItems.map((item) => (
              <ItemRow
                key={`${item.kind}-${item.id}`}
                item={item}
                interactive={isToday}
                onToggle={() => (item.kind === "habit" ? toggleHabitDone(item.id, true) : toggleTask(item.id))}
              />
            ))}
          </>
        )}

        {plan.overflow.length > 0 && (
          <>
            <div style={{ padding: "10px 20px", fontSize: "10.5px", color: COLORS.dim, letterSpacing: "1px", textTransform: "uppercase", borderBottom: `1px solid ${COLORS.border}`, marginTop: "6px" }}>
              overflow — didn't fit{isToday ? " today" : ""}
            </div>
            {plan.overflow.map((item) => (
              <OverflowRow
                key={`${item.kind}-${item.id}`}
                item={item}
                squeezed={squeezeIds.has(`${item.kind}:${item.id}`)}
                onSqueeze={() => toggleSqueeze(item.kind, item.id)}
                onDefer={() => deferTaskForward(item.id)}
                deferLabel={deferLabel}
              />
            ))}
          </>
        )}
      </div>

      {managingShapes && (
        <DayShapeEditModal dayShapes={dayShapes} onAdd={addDayShape} onUpdate={updateDayShape} onRemove={removeDayShape} onClose={() => setManagingShapes(false)} />
      )}
    </div>
  );
}
