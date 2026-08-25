import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

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

const DEFAULT_TARGET_MIN = 40 * 60;
const DAY_LABELS_FULL = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

// --- date/time helpers -----------------------------------------------

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function startOfWeekMonday(d) {
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  return monday;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function workedMinutes(entry) {
  if (!entry || !entry.start || !entry.end) return 0;
  const start = timeToMinutes(entry.start);
  const end = timeToMinutes(entry.end);
  const brk = entry.breakMin || 0;
  return Math.max(0, end - start - brk);
}

function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// --- seed data ---------------------------------------------------

const today0 = startOfToday();
const monday0 = startOfWeekMonday(today0);

const initialLogs = {
  [toISO(addDays(monday0, 0))]: { start: "07:30", end: "16:00", breakMin: 30 },
  [toISO(addDays(monday0, 1))]: { start: "08:00", end: "16:00", breakMin: 30 },
  [toISO(addDays(monday0, 2))]: { start: "07:30", end: "16:30", breakMin: 30 },
};

function ProgressBar({ totalMin, targetMin }) {
  const segments = 20;
  const filled = Math.min(segments, Math.round((totalMin / targetMin) * segments));
  const met = totalMin >= targetMin;
  const color = met ? COLORS.sage : COLORS.amber;
  return (
    <div
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "15px",
        letterSpacing: "-1px",
        color,
        lineHeight: 1,
        wordBreak: "break-all",
        textShadow: `0 0 6px ${met ? COLORS.sage : COLORS.amberDim}`,
      }}
    >
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
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 20px",
        borderBottom: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${isToday ? COLORS.amber : "transparent"}`,
        cursor: "pointer",
      }}
    >
      <div style={{ width: "68px", flexShrink: 0 }}>
        <div style={{ fontSize: "12.5px", color: isToday ? COLORS.amber : COLORS.text, fontWeight: isToday ? 600 : 400 }}>
          {label}
        </div>
        <div style={{ fontSize: "10px", color: COLORS.dim }}>{dateLabel}</div>
      </div>
      <div style={{ flex: 1, fontSize: "12px", color: entry ? COLORS.dim : COLORS.border }}>
        {entry ? `${entry.start}–${entry.end} · ${entry.breakMin}m break` : "not logged"}
      </div>
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "13px",
          fontWeight: 600,
          color: entry ? COLORS.text : COLORS.border,
          flexShrink: 0,
        }}
      >
        {entry ? formatMinutes(min) : "—"}
      </div>
    </div>
  );
}

export default function HoursView() {
  const [logs, setLogs] = useState(initialLogs);
  const [weekTargets, setWeekTargets] = useState({});
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

  const weekEntries = weekDays.map((d) => ({ date: d, entry: logs[toISO(d)] || null }));
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
    setWeekTargets((prev) => ({ ...prev, [weekKey]: v }));
    setEditingTarget(false);
  };

  const openEdit = (date) => {
    const iso = toISO(date);
    const existing = logs[iso];
    setEditStart(existing ? existing.start : "07:30");
    setEditEnd(existing ? existing.end : "16:00");
    setEditBreak(existing ? existing.breakMin : 30);
    setEditingDate(date);
  };

  const saveEdit = () => {
    const iso = toISO(editingDate);
    setLogs((prev) => ({ ...prev, [iso]: { start: editStart, end: editEnd, breakMin: Number(editBreak) || 0 } }));
    setEditingDate(null);
  };

  const clearEdit = () => {
    const iso = toISO(editingDate);
    setLogs((prev) => {
      const next = { ...prev };
      delete next[iso];
      return next;
    });
    setEditingDate(null);
  };

  const previewMin = workedMinutes({ start: editStart, end: editEnd, breakMin: Number(editBreak) || 0 });

  const dateStr = now
    .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })
    .toLowerCase();
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .nav-btn { transition: opacity 0.12s ease; cursor: pointer; }
        .nav-btn:active { opacity: 0.6; }
        .field-input { background: transparent; border: none; outline: none; color: ${COLORS.text};
          font-family: 'IBM Plex Mono', monospace; font-size: 14px; caret-color: ${COLORS.amber}; width: 100%; }
        .native-input { color-scheme: dark; accent-color: ${COLORS.amber}; }
        .native-input::-webkit-calendar-picker-indicator { filter: invert(70%) sepia(60%) saturate(900%) hue-rotate(0deg); cursor: pointer; }
      `}</style>

      <div style={{ width: "100%", maxWidth: "420px", padding: "0 0 60px 0" }}>
        {/* Header */}
        <div style={{ padding: "28px 20px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", marginBottom: "6px" }}>
            {dateStr} · {timeStr}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600, color: COLORS.amber, letterSpacing: "0.5px" }}>
            ~/hours
          </div>
        </div>

        {/* Week nav */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <span className="nav-btn" onClick={goPrev}>
            <ChevronLeft size={18} color={COLORS.dim} />
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "13px", color: COLORS.text, letterSpacing: "0.3px" }}>{weekLabel}</span>
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
          <span className="nav-btn" onClick={goNext}>
            <ChevronRight size={18} color={COLORS.dim} />
          </span>
        </div>

        {/* Weekly summary */}
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
            <span
              style={{
                fontSize: "22px",
                fontWeight: 600,
                color: met ? COLORS.sage : COLORS.text,
              }}
            >
              {formatMinutes(totalMin)}
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
                className="field-input"
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "5px",
                  padding: "5px 8px",
                  fontSize: "12.5px",
                  width: "60px",
                }}
              />
              <span style={{ fontSize: "11px", color: COLORS.dim }}>h</span>
              <button
                onClick={saveTarget}
                style={{
                  background: COLORS.amber,
                  border: "none",
                  color: COLORS.bg,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "5px 10px",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                save
              </button>
              <button
                onClick={() => setEditingTarget(false)}
                style={{
                  background: "none",
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.dim,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "11px",
                  padding: "5px 10px",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
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
            <DayRow
              key={toISO(date)}
              date={date}
              entry={entry}
              isToday={toISO(date) === toISO(today0)}
              onOpen={() => openEdit(date)}
            />
          ))}
        </div>

        {/* Edit panel */}
        {editingDate && (
          <div
            style={{
              margin: "16px 16px 0",
              padding: "14px 16px",
              border: `1px solid ${COLORS.borderBright}`,
              borderRadius: "8px",
              background: COLORS.panel,
            }}
          >
            <div style={{ fontSize: "12px", color: COLORS.dim, marginBottom: "12px" }}>
              {DAY_LABELS_FULL[(editingDate.getDay() + 6) % 7]}{" "}
              {editingDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toLowerCase()}
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "10px", color: COLORS.dim, marginBottom: "4px" }}>start</div>
                <input
                  type="time"
                  className="field-input native-input"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  style={{ border: `1px solid ${COLORS.border}`, borderRadius: "5px", padding: "7px 8px", fontSize: "13px" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "10px", color: COLORS.dim, marginBottom: "4px" }}>end</div>
                <input
                  type="time"
                  className="field-input native-input"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  style={{ border: `1px solid ${COLORS.border}`, borderRadius: "5px", padding: "7px 8px", fontSize: "13px" }}
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
                className="field-input"
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "5px",
                  padding: "7px 8px",
                  fontSize: "13px",
                  width: "80px",
                }}
              />
            </div>

            <div
              style={{
                fontSize: "11.5px",
                color: COLORS.dim,
                marginBottom: "14px",
                padding: "8px 10px",
                background: COLORS.bg,
                borderRadius: "5px",
              }}
            >
              worked: <span style={{ color: COLORS.amber, fontWeight: 600 }}>{formatMinutes(previewMin)}</span>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
              {logs[toISO(editingDate)] ? (
                <button
                  onClick={clearEdit}
                  style={{
                    background: "none",
                    border: "none",
                    color: COLORS.dim,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "12px",
                    cursor: "pointer",
                    padding: "7px 4px",
                  }}
                >
                  clear day
                </button>
              ) : (
                <span />
              )}
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setEditingDate(null)}
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
                  onClick={saveEdit}
                  style={{
                    background: COLORS.amber,
                    border: "none",
                    color: COLORS.bg,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    padding: "7px 14px",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
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
