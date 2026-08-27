import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { useClock } from "../hooks/useClock.js";
import { useHours } from "../hooks/useHours.js";
import { TOPBAR_HEIGHT } from "../components/TopBar.jsx";
import { toISO, startOfToday, startOfWeekMonday, addDays } from "../lib/dateUtils.js";
import { workedMinutes, formatMinutes } from "../lib/timeUtils.js";

const DAY_LABELS_FULL = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const today0 = startOfToday();

function ProgressBar({ totalMin, targetMin }) {
  const segments = 20;
  const filled = targetMin > 0 ? Math.min(segments, Math.round((totalMin / targetMin) * segments)) : 0;
  const met = totalMin >= targetMin;
  const color = met ? COLORS.sage : COLORS.amber;
  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "15px", letterSpacing: "-1px", color, lineHeight: 1, wordBreak: "break-all", textShadow: `0 0 6px ${met ? COLORS.sage : COLORS.amberDim}` }}>
      {"█".repeat(filled)}
      <span style={{ color: COLORS.border }}>{"░".repeat(segments - filled)}</span>
    </div>
  );
}

function DayRow({ date, entry, isToday, onOpen }) {
  const label = DAY_LABELS_FULL[(date.getDay() + 6) % 7].slice(0, 3);
  const dateLabel = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toLowerCase();
  const min = workedMinutes(entry);
  return (
    <div
      onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${isToday ? COLORS.amber : "transparent"}`, cursor: "pointer" }}
    >
      <div style={{ width: "68px", flexShrink: 0 }}>
        <div style={{ fontSize: "12.5px", color: isToday ? COLORS.amber : COLORS.text, fontWeight: isToday ? 600 : 400 }}>{label}</div>
        <div style={{ fontSize: "10px", color: COLORS.dim }}>{dateLabel}</div>
      </div>
      <div style={{ flex: 1, fontSize: "12px", color: entry ? COLORS.dim : COLORS.border }}>
        {entry ? `${entry.start}–${entry.end} · ${entry.breakMin}m break` : "not logged"}
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", fontWeight: 600, color: entry ? COLORS.text : COLORS.border, flexShrink: 0 }}>
        {entry ? formatMinutes(min) : "—"}
      </div>
    </div>
  );
}

export default function HoursView() {
  const { worklog, weekTargets, loading, saveEntry, clearEntry, saveWeekTarget } = useHours();
  const [anchor, setAnchor] = useState(today0);
  const [editingDate, setEditingDate] = useState(null);
  const [editStart, setEditStart] = useState("07:30");
  const [editEnd, setEditEnd] = useState("16:00");
  const [editBreak, setEditBreak] = useState(30);
  const [editingTarget, setEditingTarget] = useState(false);
  const [draftTargetHours, setDraftTargetHours] = useState(40);
  const now = useClock();

  const weekStart = startOfWeekMonday(anchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = weekDays[6];
  const weekKey = toISO(weekStart);
  const targetMin = Math.round((weekTargets[weekKey] ?? 40) * 60);

  const weekEntries = weekDays.map((d) => ({ date: d, entry: worklog[toISO(d)] || null }));
  const totalMin = weekEntries.reduce((sum, e) => sum + workedMinutes(e.entry), 0);
  const remainingMin = targetMin - totalMin;
  const met = totalMin >= targetMin;

  const goPrev = () => setAnchor((a) => addDays(a, -7));
  const goNext = () => setAnchor((a) => addDays(a, 7));
  const goToday = () => setAnchor(today0);

  const openTargetEdit = () => {
    setDraftTargetHours(weekTargets[weekKey] ?? 40);
    setEditingTarget(true);
  };

  const saveTarget = () => {
    const v = Math.max(0, Number(draftTargetHours) || 0);
    saveWeekTarget(weekKey, v);
    setEditingTarget(false);
  };

  const openEdit = (date) => {
    const iso = toISO(date);
    const existing = worklog[iso];
    setEditStart(existing ? existing.start : "07:30");
    setEditEnd(existing ? existing.end : "16:00");
    setEditBreak(existing ? existing.breakMin : 30);
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
        fontFamily: "'IBM Plex Mono', monospace",
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

        {/* Week nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <span onClick={goPrev} style={{ cursor: "pointer" }}>
            <ChevronLeft size={18} color={COLORS.dim} />
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "13px", color: COLORS.text, letterSpacing: "0.3px" }}>{weekLabel}</span>
            <button
              onClick={goToday}
              style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.dim, fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", padding: "3px 8px", borderRadius: "5px", cursor: "pointer" }}
            >
              today
            </button>
          </div>
          <span onClick={goNext} style={{ cursor: "pointer" }}>
            <ChevronRight size={18} color={COLORS.dim} />
          </span>
        </div>

        {/* Weekly summary */}
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
            <span style={{ fontSize: "22px", fontWeight: 600, color: met ? COLORS.sage : COLORS.text }}>
              {loading ? "—" : formatMinutes(totalMin)}
              <span
                onClick={openTargetEdit}
                style={{ fontSize: "13px", color: COLORS.dim, fontWeight: 400, cursor: "pointer", borderBottom: `1px dashed ${COLORS.border}` }}
              >
                {" "}
                / {targetMin / 60}h
              </span>
            </span>
            <span style={{ fontSize: "11.5px", color: met ? COLORS.sage : COLORS.dim }}>
              {met ? `+${formatMinutes(totalMin - targetMin)} over` : `${formatMinutes(remainingMin)} to go`}
            </span>
          </div>
          {editingTarget ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <span style={{ fontSize: "11px", color: COLORS.dim }}>target for this week</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={draftTargetHours}
                onChange={(e) => setDraftTargetHours(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTarget();
                  if (e.key === "Escape") setEditingTarget(false);
                }}
                autoFocus
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "5px",
                  padding: "5px 8px",
                  fontSize: "12.5px",
                  width: "60px",
                  background: "transparent",
                  color: COLORS.text,
                  fontFamily: "'IBM Plex Mono', monospace",
                  caretColor: COLORS.amber,
                }}
              />
              <span style={{ fontSize: "11px", color: COLORS.dim }}>h</span>
              <button
                onClick={saveTarget}
                style={{ background: COLORS.amber, border: "none", color: COLORS.bg, fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 600, padding: "5px 10px", borderRadius: "5px", cursor: "pointer" }}
              >
                save
              </button>
              <button
                onClick={() => setEditingTarget(false)}
                style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.dim, fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", padding: "5px 10px", borderRadius: "5px", cursor: "pointer" }}
              >
                cancel
              </button>
            </div>
          ) : null}
          <ProgressBar totalMin={totalMin} targetMin={targetMin} />
        </div>

        {/* Day list */}
        <div>
          {weekEntries.map(({ date, entry }) => (
            <DayRow key={toISO(date)} date={date} entry={entry} isToday={toISO(date) === toISO(today0)} onOpen={() => openEdit(date)} />
          ))}
        </div>

        {/* Edit panel */}
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
                  style={{ border: `1px solid ${COLORS.border}`, borderRadius: "5px", padding: "7px 8px", fontSize: "13px", background: "transparent", color: COLORS.text, fontFamily: "'IBM Plex Mono', monospace", caretColor: COLORS.amber, colorScheme: "dark", accentColor: COLORS.amber, width: "100%" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "10px", color: COLORS.dim, marginBottom: "4px" }}>end</div>
                <input
                  type="time"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  style={{ border: `1px solid ${COLORS.border}`, borderRadius: "5px", padding: "7px 8px", fontSize: "13px", background: "transparent", color: COLORS.text, fontFamily: "'IBM Plex Mono', monospace", caretColor: COLORS.amber, colorScheme: "dark", accentColor: COLORS.amber, width: "100%" }}
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
                style={{ border: `1px solid ${COLORS.border}`, borderRadius: "5px", padding: "7px 8px", fontSize: "13px", width: "80px", background: "transparent", color: COLORS.text, fontFamily: "'IBM Plex Mono', monospace", caretColor: COLORS.amber }}
              />
            </div>

            <div style={{ fontSize: "11.5px", color: COLORS.dim, marginBottom: "14px", padding: "8px 10px", background: COLORS.bg, borderRadius: "5px" }}>
              worked: <span style={{ color: COLORS.amber, fontWeight: 600 }}>{formatMinutes(previewMin)}</span>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
              {worklog[toISO(editingDate)] ? (
                <button
                  onClick={clearEditedDay}
                  style={{ background: "none", border: "none", color: COLORS.dim, fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", cursor: "pointer", padding: "7px 4px" }}
                >
                  clear day
                </button>
              ) : (
                <span />
              )}
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setEditingDate(null)}
                  style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.dim, fontFamily: "'IBM Plex Mono', monospace", fontSize: "12.5px", padding: "7px 14px", borderRadius: "6px", cursor: "pointer" }}
                >
                  cancel
                </button>
                <button
                  onClick={saveEdit}
                  style={{ background: COLORS.amber, border: "none", color: COLORS.bg, fontFamily: "'IBM Plex Mono', monospace", fontSize: "12.5px", fontWeight: 600, padding: "7px 14px", borderRadius: "6px", cursor: "pointer" }}
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
