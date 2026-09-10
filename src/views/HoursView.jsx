import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { useClock } from "../hooks/useClock.js";
import { useHours } from "../hooks/useHours.js";
import { TOPBAR_HEIGHT } from "../components/TopBar.jsx";
import { toISO, startOfToday, startOfWeekMonday, addDays } from "../lib/dateUtils.js";
import { workedMinutes, formatMinutes, formatSignedMinutes, balanceMinutes, isCompleteEntry, timeToMinutes, nowHHMM } from "../lib/timeUtils.js";

const DAY_LABELS_FULL = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const today0 = startOfToday();
const todayISO = toISO(today0);

const MONO = "'IBM Plex Mono', monospace";

const timeInputStyle = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: "5px",
  padding: "6px 8px",
  fontSize: "13px",
  background: "transparent",
  color: COLORS.text,
  fontFamily: MONO,
  caretColor: COLORS.amber,
  colorScheme: "dark",
  accentColor: COLORS.amber,
};

const primaryBtnStyle = {
  background: COLORS.amber,
  border: "none",
  color: COLORS.bg,
  fontFamily: MONO,
  fontSize: "12px",
  fontWeight: 600,
  padding: "7px 12px",
  borderRadius: "6px",
  cursor: "pointer",
};

const secondaryBtnStyle = {
  background: "none",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.dim,
  fontFamily: MONO,
  fontSize: "12px",
  padding: "7px 12px",
  borderRadius: "6px",
  cursor: "pointer",
};

const linkStyle = { fontSize: "11.5px", color: COLORS.dim, cursor: "pointer", borderBottom: `1px dashed ${COLORS.border}` };

function DayRow({ date, entry, isToday, normalDayMin, now, onOpen }) {
  const label = DAY_LABELS_FULL[(date.getDay() + 6) % 7].slice(0, 3);
  const dateLabel = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toLowerCase();
  const complete = isCompleteEntry(entry);
  const open = entry && entry.start && !entry.end;

  let middle = "not logged";
  if (complete) middle = `${entry.start}–${entry.end} · ${entry.breakMin || 0}m break`;
  else if (open) middle = `since ${entry.start}`;

  let right = "—";
  let rightColor = COLORS.border;
  if (complete) {
    const diff = workedMinutes(entry) - normalDayMin;
    right = formatSignedMinutes(diff);
    rightColor = diff >= 0 ? COLORS.sage : COLORS.amber;
  } else if (open) {
    right = isToday ? formatMinutes(Math.max(0, timeToMinutes(nowHHMM(now)) - timeToMinutes(entry.start))) : "open";
    rightColor = COLORS.amber;
  }

  return (
    <div
      onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${isToday ? COLORS.amber : "transparent"}`, cursor: "pointer" }}
    >
      <div style={{ width: "68px", flexShrink: 0 }}>
        <div style={{ fontSize: "12.5px", color: isToday ? COLORS.amber : COLORS.text, fontWeight: isToday ? 600 : 400 }}>{label}</div>
        <div style={{ fontSize: "10px", color: COLORS.dim }}>{dateLabel}</div>
      </div>
      <div style={{ flex: 1, fontSize: "12px", color: entry ? COLORS.dim : COLORS.border }}>{middle}</div>
      <div style={{ fontFamily: MONO, fontSize: "13px", fontWeight: 600, color: rightColor, flexShrink: 0 }}>{right}</div>
    </div>
  );
}

// Today's dedicated control: not-started → clock in → clocked in → clock out → done.
function TodayClock({ entry, now, normalDayMin, onClockIn, onClockOut, onEditFull, onClear }) {
  const [action, setAction] = useState(null); // null | "in" | "out"
  const [time, setTime] = useState("");
  const [breakMin, setBreakMin] = useState(30);

  const started = !!(entry && entry.start);
  const ended = isCompleteEntry(entry);

  const beginClockIn = () => {
    setTime(nowHHMM(now));
    setAction("in");
  };
  const beginClockOut = () => {
    setTime(nowHHMM(now));
    setBreakMin(entry?.breakMin ?? 30);
    setAction("out");
  };
  const cancel = () => setAction(null);
  const confirmIn = () => {
    if (!time) return;
    onClockIn(time);
    setAction(null);
  };
  const confirmOut = () => {
    if (!time) return;
    onClockOut(time, Number(breakMin) || 0);
    setAction(null);
  };

  if (!started) {
    return (
      <div style={{ padding: "18px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: "11px", color: COLORS.dim, marginBottom: "10px" }}>today · not started</div>
        {action === "in" ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} autoFocus style={timeInputStyle} />
            <button onClick={confirmIn} style={primaryBtnStyle}>
              clock in
            </button>
            <button onClick={cancel} style={secondaryBtnStyle}>
              cancel
            </button>
          </div>
        ) : (
          <button onClick={beginClockIn} style={primaryBtnStyle}>
            clock in →
          </button>
        )}
      </div>
    );
  }

  if (started && !ended) {
    const elapsed = Math.max(0, timeToMinutes(nowHHMM(now)) - timeToMinutes(entry.start));
    return (
      <div style={{ padding: "18px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: "11px", color: COLORS.dim, marginBottom: "6px" }}>today · clocked in at {entry.start}</div>
        <div style={{ fontSize: "18px", fontWeight: 600, color: COLORS.amber, marginBottom: "12px" }}>
          {formatMinutes(elapsed)} <span style={{ fontSize: "11px", color: COLORS.dim, fontWeight: 400 }}>elapsed</span>
        </div>
        {action === "out" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: COLORS.dim }}>end</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} autoFocus style={timeInputStyle} />
              <span style={{ fontSize: "10px", color: COLORS.dim }}>break</span>
              <input
                type="number"
                min={0}
                step={5}
                value={breakMin}
                onChange={(e) => setBreakMin(Math.max(0, Number(e.target.value) || 0))}
                style={{ ...timeInputStyle, width: "60px" }}
              />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={confirmOut} style={primaryBtnStyle}>
                clock out
              </button>
              <button onClick={cancel} style={secondaryBtnStyle}>
                cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={beginClockOut} style={primaryBtnStyle}>
            clock out →
          </button>
        )}
      </div>
    );
  }

  const worked = workedMinutes(entry);
  const diff = worked - normalDayMin;
  return (
    <div style={{ padding: "18px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
      <div style={{ fontSize: "11px", color: COLORS.dim, marginBottom: "6px" }}>today · done</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "13px", color: COLORS.text }}>
          {entry.start}–{entry.end} · {entry.breakMin || 0}m break · {formatMinutes(worked)}
        </span>
        <span style={{ fontSize: "13px", fontWeight: 600, color: diff >= 0 ? COLORS.sage : COLORS.amber }}>{formatSignedMinutes(diff)}</span>
      </div>
      <div style={{ display: "flex", gap: "16px", marginTop: "10px" }}>
        <span onClick={onEditFull} style={linkStyle}>
          edit
        </span>
        <span onClick={onClear} style={linkStyle}>
          reset day
        </span>
      </div>
    </div>
  );
}

export default function HoursView() {
  const { worklog, loading, saveEntry, clearEntry, normalDayHours, setNormalDayHours } = useHours();
  const [anchor, setAnchor] = useState(today0);
  const [editingDate, setEditingDate] = useState(null);
  const [editStart, setEditStart] = useState("07:30");
  const [editEnd, setEditEnd] = useState("16:00");
  const [editBreak, setEditBreak] = useState(30);
  const [editingNormalDay, setEditingNormalDay] = useState(false);
  const [draftNormalDayHours, setDraftNormalDayHours] = useState(8.5);
  const now = useClock();

  const normalDayMin = Math.round(normalDayHours * 60);
  const balanceMin = balanceMinutes(Object.values(worklog), normalDayMin);

  const weekStart = startOfWeekMonday(anchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = weekDays[6];
  const weekEntries = weekDays.map((d) => ({ date: d, entry: worklog[toISO(d)] || null }));

  const todayEntry = worklog[todayISO] || null;

  const goPrev = () => setAnchor((a) => addDays(a, -7));
  const goNext = () => setAnchor((a) => addDays(a, 7));
  const goToday = () => setAnchor(today0);

  const openNormalDayEdit = () => {
    setDraftNormalDayHours(normalDayHours);
    setEditingNormalDay(true);
  };

  const saveNormalDay = () => {
    const v = Math.max(0, Number(draftNormalDayHours) || 0);
    setNormalDayHours(v);
    setEditingNormalDay(false);
  };

  const openEdit = (date) => {
    const iso = toISO(date);
    const existing = worklog[iso];
    setEditStart(existing?.start || "07:30");
    setEditEnd(existing?.end || "16:00");
    setEditBreak(existing?.breakMin ?? 30);
    setEditingDate(date);
  };

  const saveEdit = () => {
    saveEntry(toISO(editingDate), { start: editStart, end: editEnd, breakMin: Number(editBreak) || 0 });
    setEditingDate(null);
  };

  const clearEditedDay = () => {
    clearEntry(toISO(editingDate));
    setEditingDate(null);
  };

  const previewMin = workedMinutes({ start: editStart, end: editEnd, breakMin: Number(editBreak) || 0 });

  const clockIn = (time) => saveEntry(todayISO, { start: time, end: null, breakMin: 0 });
  const clockOut = (time, breakMin) => saveEntry(todayISO, { start: todayEntry.start, end: time, breakMin });

  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const weekLabel = sameMonth
    ? `${weekStart.getDate()}–${weekEnd.getDate()} ${weekStart.toLocaleDateString("en-GB", { month: "short" }).toLowerCase()}`
    : `${weekStart.getDate()} ${weekStart.toLocaleDateString("en-GB", { month: "short" }).toLowerCase()} – ${weekEnd.getDate()} ${weekEnd.toLocaleDateString("en-GB", { month: "short" }).toLowerCase()}`;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 2px)",
        fontFamily: MONO,
        color: COLORS.text,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px", padding: `${TOPBAR_HEIGHT}px 0 60px 0` }}>
        {/* Header */}
        <div style={{ padding: "28px 20px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", marginBottom: "6px" }}>
            {dateStr} · {timeStr}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600, color: COLORS.amber, letterSpacing: "0.5px" }}>~/hours</div>
        </div>

        {/* Balance */}
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: "11px", color: COLORS.dim, marginBottom: "8px" }}>balance</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span
              style={{
                fontFamily: MONO,
                fontSize: "28px",
                fontWeight: 600,
                color: balanceMin >= 0 ? COLORS.sage : COLORS.amber,
                textShadow: `0 0 8px ${balanceMin >= 0 ? COLORS.sage : COLORS.amberDim}`,
              }}
            >
              {loading ? "—" : formatSignedMinutes(balanceMin)}
            </span>
            <span onClick={openNormalDayEdit} style={linkStyle}>
              {normalDayHours}h / day
            </span>
          </div>
          {editingNormalDay ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
              <span style={{ fontSize: "11px", color: COLORS.dim }}>normal work day</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={draftNormalDayHours}
                onChange={(e) => setDraftNormalDayHours(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveNormalDay();
                  if (e.key === "Escape") setEditingNormalDay(false);
                }}
                autoFocus
                style={{ ...timeInputStyle, width: "60px" }}
              />
              <span style={{ fontSize: "11px", color: COLORS.dim }}>h</span>
              <button onClick={saveNormalDay} style={primaryBtnStyle}>
                save
              </button>
              <button onClick={() => setEditingNormalDay(false)} style={secondaryBtnStyle}>
                cancel
              </button>
            </div>
          ) : null}
        </div>

        {/* Today's clock in/out */}
        <TodayClock
          entry={todayEntry}
          now={now}
          normalDayMin={normalDayMin}
          onClockIn={clockIn}
          onClockOut={clockOut}
          onEditFull={() => openEdit(today0)}
          onClear={() => clearEntry(todayISO)}
        />

        {/* Week nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <span onClick={goPrev} style={{ cursor: "pointer" }}>
            <ChevronLeft size={18} color={COLORS.dim} />
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "13px", color: COLORS.text, letterSpacing: "0.3px" }}>{weekLabel}</span>
            <button
              onClick={goToday}
              style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.dim, fontFamily: MONO, fontSize: "10px", padding: "3px 8px", borderRadius: "5px", cursor: "pointer" }}
            >
              today
            </button>
          </div>
          <span onClick={goNext} style={{ cursor: "pointer" }}>
            <ChevronRight size={18} color={COLORS.dim} />
          </span>
        </div>

        {/* Day list */}
        <div>
          {weekEntries.map(({ date, entry }) => (
            <DayRow
              key={toISO(date)}
              date={date}
              entry={entry}
              isToday={toISO(date) === todayISO}
              normalDayMin={normalDayMin}
              now={now}
              onOpen={() => openEdit(date)}
            />
          ))}
        </div>

        {/* Edit panel — manual correction/backfill for any day */}
        {editingDate && (
          <div style={{ margin: "16px 16px 0", padding: "14px 16px", border: `1px solid ${COLORS.borderBright}`, borderRadius: "8px", background: COLORS.panel }}>
            <div style={{ fontSize: "12px", color: COLORS.dim, marginBottom: "12px" }}>
              {DAY_LABELS_FULL[(editingDate.getDay() + 6) % 7]} {editingDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toLowerCase()}
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "10px", color: COLORS.dim, marginBottom: "4px" }}>start</div>
                <input
                  type="time"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  style={{ ...timeInputStyle, padding: "7px 8px", width: "100%" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "10px", color: COLORS.dim, marginBottom: "4px" }}>end</div>
                <input
                  type="time"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  style={{ ...timeInputStyle, padding: "7px 8px", width: "100%" }}
                />
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "10px", color: COLORS.dim, marginBottom: "4px" }}>break (minutes)</div>
              <input
                type="number"
                min={0}
                step={5}
                value={editBreak}
                onChange={(e) => setEditBreak(Math.max(0, Number(e.target.value) || 0))}
                style={{ ...timeInputStyle, padding: "7px 8px", width: "80px" }}
              />
            </div>

            <div style={{ fontSize: "11.5px", color: COLORS.dim, marginBottom: "14px", padding: "8px 10px", background: COLORS.bg, borderRadius: "5px" }}>
              worked: <span style={{ color: COLORS.amber, fontWeight: 600 }}>{formatMinutes(previewMin)}</span>
              {" · "}
              vs {normalDayHours}h: <span style={{ color: previewMin - normalDayMin >= 0 ? COLORS.sage : COLORS.amber, fontWeight: 600 }}>{formatSignedMinutes(previewMin - normalDayMin)}</span>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
              {worklog[toISO(editingDate)] ? (
                <button
                  onClick={clearEditedDay}
                  style={{ background: "none", border: "none", color: COLORS.dim, fontFamily: MONO, fontSize: "12px", cursor: "pointer", padding: "7px 4px" }}
                >
                  clear day
                </button>
              ) : (
                <span />
              )}
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setEditingDate(null)}
                  style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.dim, fontFamily: MONO, fontSize: "12.5px", padding: "7px 14px", borderRadius: "6px", cursor: "pointer" }}
                >
                  cancel
                </button>
                <button
                  onClick={saveEdit}
                  style={{ background: COLORS.amber, border: "none", color: COLORS.bg, fontFamily: MONO, fontSize: "12.5px", fontWeight: 600, padding: "7px 14px", borderRadius: "6px", cursor: "pointer" }}
                >
                  save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
