import { useRef, useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { useClock } from "../hooks/useClock.js";
import { useCountdowns } from "../hooks/useCountdowns.js";
import { NAV_HEIGHT } from "../components/NavBar.jsx";
import { parseISODate, startOfToday, nextOccurrence, daysBetween } from "../lib/dateUtils.js";

function formatOriginalDate(d) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toLowerCase();
}

function CounterBadge({ days }) {
  const isToday = days === 0;
  const padded = String(Math.min(days, 999)).padStart(3, "0");
  return (
    <span
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "15px",
        fontWeight: 600,
        color: isToday ? COLORS.sage : COLORS.amber,
        width: "62px",
        flexShrink: 0,
        userSelect: "none",
        letterSpacing: "0.5px",
        textShadow: isToday ? `0 0 10px ${COLORS.sage}` : `0 0 8px ${COLORS.amberDim}`,
      }}
    >
      {isToday ? "[NOW]" : `[${padded}]`}
    </span>
  );
}

export default function CountdownsView() {
  const { countdowns, loading, addCountdown, removeCountdown } = useCountdowns();
  const [adding, setAdding] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [dateDraft, setDateDraft] = useState("");
  const labelRef = useRef(null);
  const now = useClock();
  const today = startOfToday();

  useEffect(() => {
    if (adding && labelRef.current) labelRef.current.focus();
  }, [adding]);

  const rows = countdowns
    .map((c) => {
      const original = parseISODate(c.date);
      const next = nextOccurrence(original, today);
      const days = daysBetween(today, next);
      const turningYears = next.getFullYear() - original.getFullYear();
      return { ...c, original, days, turningYears };
    })
    .sort((a, b) => a.days - b.days);

  const commitDraft = () => {
    const label = labelDraft.trim();
    if (label && dateDraft) {
      addCountdown({ label, date: dateDraft });
    }
    setLabelDraft("");
    setDateDraft("");
    setAdding(false);
  };

  const cancelDraft = () => {
    setLabelDraft("");
    setDateDraft("");
    setAdding(false);
  };

  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  const canCommit = labelDraft.trim().length > 0 && dateDraft.length > 0;

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
      <div style={{ width: "100%", maxWidth: "420px", padding: `0 0 ${100 + NAV_HEIGHT}px 0` }}>
        {/* Header */}
        <div style={{ padding: "28px 20px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", marginBottom: "6px" }}>
            {dateStr} · {timeStr}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600, color: COLORS.amber, letterSpacing: "0.5px" }}>
            ~/countdowns
          </div>
          <div style={{ fontSize: "12px", color: COLORS.dim, marginTop: "4px" }}>
            {loading ? "loading…" : `${rows.length} tracked`}
          </div>
        </div>

        {/* List */}
        <div>
          {rows.map((r) => (
            <div
              key={r.id}
              className="row"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "14px 20px",
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <CounterBadge days={r.days} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14.5px", color: COLORS.text, wordBreak: "break-word" }}>{r.label}</div>
                <div style={{ fontSize: "12px", color: COLORS.dim, marginTop: "3px" }}>
                  {formatOriginalDate(r.original)} · turns {r.turningYears}
                </div>
              </div>
              <button
                onClick={() => removeCountdown(r.id)}
                style={{ background: "none", border: "none", padding: "2px", cursor: "pointer", flexShrink: 0 }}
                aria-label="Remove countdown"
              >
                <X size={14} color={COLORS.dim} />
              </button>
            </div>
          ))}

          {/* Inline add form */}
          {adding && (
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.borderBright}`, background: COLORS.panel }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ color: COLORS.amber, fontSize: "14px", width: "16px", flexShrink: 0 }}>{">"}</span>
                <input
                  ref={labelRef}
                  className="task-input"
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancelDraft();
                  }}
                  placeholder="label, e.g. mom's birthday"
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: COLORS.text,
                    caretColor: COLORS.amber,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "14.5px",
                    width: "100%",
                  }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span style={{ color: COLORS.dim, fontSize: "12px", width: "16px", flexShrink: 0 }}>#</span>
                <input
                  type="date"
                  className="date-input"
                  value={dateDraft}
                  onChange={(e) => setDateDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancelDraft();
                    if (e.key === "Enter" && canCommit) commitDraft();
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: COLORS.text,
                    caretColor: COLORS.amber,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "14.5px",
                    colorScheme: "dark",
                    accentColor: COLORS.amber,
                  }}
                />
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
                  disabled={!canCommit}
                  style={{
                    background: canCommit ? COLORS.amber : COLORS.border,
                    border: "none",
                    color: canCommit ? COLORS.bg : COLORS.dim,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    padding: "7px 14px",
                    borderRadius: "6px",
                    cursor: canCommit ? "pointer" : "default",
                  }}
                >
                  add
                </button>
              </div>
            </div>
          )}

          {!loading && rows.length === 0 && !adding && (
            <div style={{ padding: "40px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>
              // no countdowns tracked yet
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
    </div>
  );
}
