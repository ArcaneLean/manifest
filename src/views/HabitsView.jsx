import { useRef, useState, useEffect } from "react";
import { Plus, X, Flame } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { Toggle } from "../components/Toggle.jsx";
import { HabitHeatmap } from "../components/HabitHeatmap.jsx";
import { HabitDetailModal } from "../components/HabitDetailModal.jsx";
import { useClock } from "../hooks/useClock.js";
import { useHabits } from "../hooks/useHabits.js";
import { TOPBAR_HEIGHT } from "../components/TopBar.jsx";
import { formatRelativeTime } from "../lib/habitStats.js";
import { startOfToday } from "../lib/dateUtils.js";

const MINI_WEEKS = 14;

export default function HabitsView() {
  const { habits, entries, loading, addHabit, updateHabit, removeHabit, logEntry, removeEntry } = useHabits();
  const [adding, setAdding] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [negativeDraft, setNegativeDraft] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const nameRef = useRef(null);
  const now = useClock();
  const today = startOfToday();

  useEffect(() => {
    if (adding && nameRef.current) nameRef.current.focus();
  }, [adding]);

  const entriesByHabit = (habitId) => entries.filter((e) => e.habitId === habitId);

  const rows = habits
    .map((h) => {
      const habitEntries = entriesByHabit(h.id);
      const lastTs = habitEntries.reduce((max, e) => (e.ts > max ? e.ts : max), 0) || null;
      return { habit: h, entries: habitEntries, lastTs };
    })
    .sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));

  const commitDraft = () => {
    const name = nameDraft.trim();
    if (name) addHabit({ name, type: negativeDraft ? "negative" : "positive" });
    setNameDraft("");
    setNegativeDraft(false);
    setAdding(false);
  };

  const cancelDraft = () => {
    setNameDraft("");
    setNegativeDraft(false);
    setAdding(false);
  };

  const selected = rows.find((r) => r.habit.id === selectedId);
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  const canCommit = nameDraft.trim().length > 0;

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
      <div style={{ width: "100%", maxWidth: "420px", padding: `${TOPBAR_HEIGHT}px 0 100px 0` }}>
        <div style={{ padding: "28px 20px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", marginBottom: "6px" }}>
            {dateStr} · {timeStr}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600, color: COLORS.amber, letterSpacing: "0.5px" }}>~/habits</div>
          <div style={{ fontSize: "12px", color: COLORS.dim, marginTop: "4px" }}>
            {loading ? "loading…" : `${rows.length} tracked`}
          </div>
        </div>

        <div>
          {rows.map(({ habit, entries: habitEntries, lastTs }) => {
            const color = habit.type === "negative" ? COLORS.danger : COLORS.sage;
            return (
              <div
                key={habit.id}
                className="row"
                style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}` }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <button
                    onClick={() => setSelectedId(habit.id)}
                    style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
                  >
                    <div style={{ fontSize: "14.5px", color: COLORS.text, wordBreak: "break-word" }}>{habit.name}</div>
                    <div style={{ fontSize: "12px", color: COLORS.dim, marginTop: "2px" }}>last: {formatRelativeTime(lastTs, now)}</div>
                  </button>
                  <button
                    onClick={() => logEntry(habit.id)}
                    aria-label={`Log ${habit.name}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "30px",
                      height: "30px",
                      borderRadius: "6px",
                      background: "none",
                      border: `1px solid ${COLORS.border}`,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <Flame size={14} color={color} strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => removeHabit(habit.id)}
                    aria-label="Remove habit"
                    style={{ background: "none", border: "none", padding: "2px", cursor: "pointer", flexShrink: 0 }}
                  >
                    <X size={14} color={COLORS.dim} />
                  </button>
                </div>
                <button
                  onClick={() => setSelectedId(habit.id)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "block" }}
                >
                  <HabitHeatmap timestamps={habitEntries.map((e) => e.ts)} weeks={MINI_WEEKS} today={today} color={color} />
                </button>
              </div>
            );
          })}

          {adding && (
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.borderBright}`, background: COLORS.panel }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span style={{ color: COLORS.amber, fontSize: "14px", width: "16px", flexShrink: 0 }}>{">"}</span>
                <input
                  ref={nameRef}
                  className="task-input"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancelDraft();
                    if (e.key === "Enter" && canCommit) commitDraft();
                  }}
                  placeholder="habit, e.g. floss / smoke"
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
              <div style={{ marginBottom: "12px" }}>
                <Toggle value={negativeDraft} onChange={setNegativeDraft} leftLabel="positive" rightLabel="negative" />
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
              // no habits tracked yet
            </div>
          )}
        </div>

        {!adding && (
          <button
            className="fab"
            onClick={() => setAdding(true)}
            style={{
              position: "fixed",
              bottom: "28px",
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

      {selected && (
        <HabitDetailModal
          key={selected.habit.id}
          habit={selected.habit}
          entries={selected.entries}
          now={now.getTime()}
          onLog={() => logEntry(selected.habit.id)}
          onBackfill={(ts) => logEntry(selected.habit.id, ts)}
          onRemoveEntry={removeEntry}
          onRename={(patch) => updateHabit(selected.habit.id, patch)}
          onDelete={() => {
            removeHabit(selected.habit.id);
            setSelectedId(null);
          }}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
