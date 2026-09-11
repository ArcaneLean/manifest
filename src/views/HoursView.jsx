import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { useClock } from "../hooks/useClock.js";
import { useHours } from "../hooks/useHours.js";
import { useProjects } from "../hooks/useProjects.js";
import { TOPBAR_HEIGHT } from "../components/TopBar.jsx";
import { NAV_HEIGHT } from "../components/NavBar.jsx";
import { toISO, startOfToday, startOfWeekMonday, addDays } from "../lib/dateUtils.js";
import {
  workedMinutes,
  breakMinutes,
  projectTotals,
  formatMinutes,
  formatSignedMinutes,
  balanceMinutes,
  isDayStarted,
  isCompleteEntry,
  openSegment,
  timeToMinutes,
  nowHHMM,
} from "../lib/timeUtils.js";

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

function projectName(projects, id) {
  return projects.find((p) => p.id === id)?.name || "?";
}
function projectColor(projects, id) {
  return projects.find((p) => p.id === id)?.color || COLORS.dim;
}
function summaryLabel(projects, projectId, minutes) {
  return `${projectId ? projectName(projects, projectId) : "break"} ${formatMinutes(minutes)}`;
}

// Small colored chip used for project/break selection and for the read-only
// per-project breakdown once a day is done — same visual language as
// TagPickerChip (components/TagChip.jsx), plus a "break" option tags don't
// need.
function PickChip({ label, color, active, onClick }) {
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
        border: `1px solid ${active ? color : COLORS.border}`,
        color: active ? color : COLORS.dim,
        background: active ? `${color}18` : "transparent",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

// Time + explicit project-or-break picker, shared by clock-in and switch —
// there's no default selection, so confirming always reflects a deliberate
// choice rather than a silently-assumed project.
function ProjectTimeAction({ label, time, setTime, projectId, setProjectId, projects, onConfirm, onCancel }) {
  const disabled = !time || projectId === undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} autoFocus style={timeInputStyle} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        <PickChip label="break" color={COLORS.dim} active={projectId === null} onClick={() => setProjectId(null)} />
        {projects.map((p) => (
          <PickChip key={p.id} label={p.name} color={p.color} active={projectId === p.id} onClick={() => setProjectId(p.id)} />
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={onConfirm} disabled={disabled} style={{ ...primaryBtnStyle, opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer" }}>
          {label}
        </button>
        <button onClick={onCancel} style={secondaryBtnStyle}>
          cancel
        </button>
      </div>
    </div>
  );
}

function DayRow({ date, entry, isToday, projects, normalDayMin, now, onOpen }) {
  const label = DAY_LABELS_FULL[(date.getDay() + 6) % 7].slice(0, 3);
  const dateLabel = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toLowerCase();
  const complete = isCompleteEntry(entry);
  const open = openSegment(entry);

  let middle = "not logged";
  if (complete) middle = projectTotals(entry).map(({ projectId, minutes }) => summaryLabel(projects, projectId, minutes)).join(" · ");
  else if (open) middle = `${open.projectId ? projectName(projects, open.projectId) : "break"} since ${open.start}`;

  let right = "—";
  let rightColor = COLORS.border;
  if (complete) {
    const diff = workedMinutes(entry) - normalDayMin;
    right = formatSignedMinutes(diff);
    rightColor = diff >= 0 ? COLORS.sage : COLORS.amber;
  } else if (open) {
    right = isToday ? formatMinutes(Math.max(0, timeToMinutes(nowHHMM(now)) - timeToMinutes(open.start))) : "open";
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

// Today's dedicated control: not-started → clock in (project/break) →
// clocked in (switch project/break, or clock out) → done.
function TodayClock({ entry, projects, now, normalDayMin, onClockIn, onSwitch, onClockOut, onEditFull, onClear }) {
  const [action, setAction] = useState(null); // null | "in" | "switch" | "out"
  const [time, setTime] = useState("");
  const [projectId, setProjectId] = useState(undefined);

  const started = isDayStarted(entry);
  const done = isCompleteEntry(entry);
  const open = openSegment(entry);

  const beginIn = () => {
    setTime(nowHHMM(now));
    setProjectId(undefined);
    setAction("in");
  };
  const beginSwitch = () => {
    setTime(nowHHMM(now));
    setProjectId(undefined);
    setAction("switch");
  };
  const beginOut = () => {
    setTime(nowHHMM(now));
    setAction("out");
  };
  const cancel = () => setAction(null);

  const confirmIn = () => {
    if (!time || projectId === undefined) return;
    onClockIn(time, projectId);
    setAction(null);
  };
  const confirmSwitch = () => {
    if (!time || projectId === undefined) return;
    onSwitch(time, projectId);
    setAction(null);
  };
  const confirmOut = () => {
    if (!time) return;
    onClockOut(time);
    setAction(null);
  };

  if (!started) {
    return (
      <div style={{ padding: "18px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: "11px", color: COLORS.dim, marginBottom: "10px" }}>today · not started</div>
        {action === "in" ? (
          <ProjectTimeAction
            label="clock in"
            time={time}
            setTime={setTime}
            projectId={projectId}
            setProjectId={setProjectId}
            projects={projects}
            onConfirm={confirmIn}
            onCancel={cancel}
          />
        ) : (
          <button onClick={beginIn} style={primaryBtnStyle}>
            clock in →
          </button>
        )}
      </div>
    );
  }

  if (started && !done) {
    const elapsed = Math.max(0, timeToMinutes(nowHHMM(now)) - timeToMinutes(open.start));
    const totalSoFar = workedMinutes(entry) + (open.projectId ? elapsed : 0);
    const onBreak = !open.projectId;
    return (
      <div style={{ padding: "18px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: "11px", color: COLORS.dim, marginBottom: "6px" }}>
          today · {onBreak ? "on break" : "on "}
          {!onBreak && <span style={{ color: projectColor(projects, open.projectId) }}>{projectName(projects, open.projectId)}</span>}
          {" since "}
          {open.start}
        </div>
        <div style={{ fontSize: "18px", fontWeight: 600, color: COLORS.amber, marginBottom: "4px" }}>
          {formatMinutes(elapsed)} <span style={{ fontSize: "11px", color: COLORS.dim, fontWeight: 400 }}>elapsed</span>
        </div>
        <div style={{ fontSize: "11px", color: COLORS.dim, marginBottom: "12px" }}>{formatMinutes(totalSoFar)} worked today so far</div>
        {action === "switch" ? (
          <ProjectTimeAction
            label="switch"
            time={time}
            setTime={setTime}
            projectId={projectId}
            setProjectId={setProjectId}
            projects={projects}
            onConfirm={confirmSwitch}
            onCancel={cancel}
          />
        ) : action === "out" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} autoFocus style={timeInputStyle} />
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
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={beginSwitch} style={primaryBtnStyle}>
              switch →
            </button>
            <button onClick={beginOut} style={secondaryBtnStyle}>
              clock out
            </button>
          </div>
        )}
      </div>
    );
  }

  const worked = workedMinutes(entry);
  const brk = breakMinutes(entry);
  const diff = worked - normalDayMin;
  return (
    <div style={{ padding: "18px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
      <div style={{ fontSize: "11px", color: COLORS.dim, marginBottom: "6px" }}>today · done</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
        {projectTotals(entry).map(({ projectId: pid, minutes }) => (
          <PickChip key={pid ?? "break"} label={summaryLabel(projects, pid, minutes)} color={pid ? projectColor(projects, pid) : COLORS.dim} active />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "13px", color: COLORS.text }}>
          {formatMinutes(worked)} worked · {formatMinutes(brk)} break
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

// One row of the backfill/edit segment list — project-or-break select, start
// and end time, delete.
function SegmentRow({ seg, projects, onChange, onRemove }) {
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: seg.projectId ? projectColor(projects, seg.projectId) : COLORS.dim, flexShrink: 0 }} />
      <select
        value={seg.projectId || ""}
        onChange={(e) => onChange({ ...seg, projectId: e.target.value || null })}
        style={{ ...timeInputStyle, flex: 1, padding: "6px 6px", minWidth: 0 }}
      >
        <option value="">break</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input type="time" value={seg.start} onChange={(e) => onChange({ ...seg, start: e.target.value })} style={{ ...timeInputStyle, width: "88px" }} />
      <span style={{ color: COLORS.dim, fontSize: "11px" }}>–</span>
      <input type="time" value={seg.end || ""} onChange={(e) => onChange({ ...seg, end: e.target.value || null })} style={{ ...timeInputStyle, width: "88px" }} />
      <span onClick={onRemove} style={{ cursor: "pointer", flexShrink: 0 }}>
        <X size={14} color={COLORS.dim} />
      </span>
    </div>
  );
}

export default function HoursView() {
  const { worklog, loading, saveEntry, clearEntry, clockIn, switchSegment, clockOut, normalDayHours, setNormalDayHours } = useHours();
  const { projects } = useProjects();
  const [anchor, setAnchor] = useState(today0);
  const [editingDate, setEditingDate] = useState(null);
  const [editSegments, setEditSegments] = useState([]);
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
    setEditSegments(
      existing && existing.segments.length > 0
        ? existing.segments.map((s) => ({ ...s }))
        : [{ start: "07:30", end: "16:00", projectId: projects[0]?.id ?? null }]
    );
    setEditingDate(date);
  };

  const updateSegmentRow = (i, next) => {
    setEditSegments((prev) => prev.map((s, idx) => (idx === i ? next : s)));
  };

  const removeSegmentRow = (i) => {
    setEditSegments((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addSegmentRow = () => {
    const last = editSegments[editSegments.length - 1];
    const start = last?.end || last?.start || "09:00";
    setEditSegments((prev) => [...prev, { start, end: null, projectId: projects[0]?.id ?? null }]);
  };

  const saveEdit = () => {
    saveEntry(toISO(editingDate), editSegments.filter((s) => s.start));
    setEditingDate(null);
  };

  const clearEditedDay = () => {
    clearEntry(toISO(editingDate));
    setEditingDate(null);
  };

  const previewEntry = { segments: editSegments };
  const previewWorked = workedMinutes(previewEntry);
  const previewBreak = breakMinutes(previewEntry);

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
      <div style={{ width: "100%", maxWidth: "420px", padding: `${TOPBAR_HEIGHT}px 0 ${100 + NAV_HEIGHT}px 0` }}>
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
          projects={projects}
          now={now}
          normalDayMin={normalDayMin}
          onClockIn={(time, projectId) => clockIn(todayISO, time, projectId)}
          onSwitch={(time, projectId) => switchSegment(todayISO, time, projectId)}
          onClockOut={(time) => clockOut(todayISO, time)}
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
              projects={projects}
              normalDayMin={normalDayMin}
              now={now}
              onOpen={() => openEdit(date)}
            />
          ))}
        </div>

        {/* Edit panel — manual correction/backfill for any day, as a list of
            project/break segments */}
        {editingDate && (
          <div style={{ margin: "16px 16px 0", padding: "14px 16px", border: `1px solid ${COLORS.borderBright}`, borderRadius: "8px", background: COLORS.panel }}>
            <div style={{ fontSize: "12px", color: COLORS.dim, marginBottom: "12px" }}>
              {DAY_LABELS_FULL[(editingDate.getDay() + 6) % 7]} {editingDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toLowerCase()}
            </div>

            <div style={{ marginBottom: "6px" }}>
              {editSegments.map((seg, i) => (
                <SegmentRow key={i} seg={seg} projects={projects} onChange={(next) => updateSegmentRow(i, next)} onRemove={() => removeSegmentRow(i)} />
              ))}
            </div>

            <div
              onClick={addSegmentRow}
              style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11.5px", color: COLORS.dim, cursor: "pointer", marginBottom: "14px" }}
            >
              <Plus size={12} /> add segment
            </div>

            <div style={{ fontSize: "11.5px", color: COLORS.dim, marginBottom: "14px", padding: "8px 10px", background: COLORS.bg, borderRadius: "5px" }}>
              worked: <span style={{ color: COLORS.amber, fontWeight: 600 }}>{formatMinutes(previewWorked)}</span>
              {" · "}
              break: <span style={{ color: COLORS.text, fontWeight: 600 }}>{formatMinutes(previewBreak)}</span>
              {" · "}
              vs {normalDayHours}h: <span style={{ color: previewWorked - normalDayMin >= 0 ? COLORS.sage : COLORS.amber, fontWeight: 600 }}>{formatSignedMinutes(previewWorked - normalDayMin)}</span>
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
