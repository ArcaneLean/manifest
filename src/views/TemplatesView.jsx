import { useRef, useState, useEffect } from "react";
import { Plus, Play, X } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { QUADRANTS, quadrantFor } from "../lib/quadrant.js";
import { useClock } from "../hooks/useClock.js";
import { useTags } from "../hooks/useTags.js";
import { useTasks } from "../hooks/useTasks.js";
import { useTemplates } from "../hooks/useTemplates.js";
import { usePersistentState } from "../hooks/usePersistentState.js";
import { Toggle } from "../components/Toggle.jsx";
import { Segmented } from "../components/Segmented.jsx";
import { TagChip, TagPickerChip } from "../components/TagChip.jsx";
import { NAV_HEIGHT } from "../components/NavBar.jsx";
import { startOfToday, parseISODate, daysBetween } from "../lib/dateUtils.js";
import { DAY_LABELS, nextDueDate, describeRecurrence } from "../lib/recurrence.js";

const FREQ_OPTIONS = [
  { key: "daily", label: "daily" },
  { key: "weekly", label: "weekly" },
  { key: "monthly", label: "monthly" },
];

function CounterBadge({ days }) {
  const isDue = days <= 0;
  const padded = String(Math.min(Math.max(days, 0), 999)).padStart(3, "0");
  return (
    <span
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "13px",
        fontWeight: 600,
        color: isDue ? COLORS.sage : COLORS.amber,
        width: "54px",
        flexShrink: 0,
        userSelect: "none",
        letterSpacing: "0.3px",
        textShadow: isDue ? `0 0 10px ${COLORS.sage}` : `0 0 8px ${COLORS.amberDim}`,
      }}
    >
      {isDue ? "[DUE]" : `[${padded}]`}
    </span>
  );
}

function TemplateRow({ template, today, tagById, onRun, onDelete }) {
  const q = QUADRANTS[quadrantFor(template.urgent, template.important)];
  const isRecurring = !!template.recurring;
  const lastRun = template.lastRun ? parseISODate(template.lastRun) : null;
  const due = isRecurring ? nextDueDate(template.recurring, lastRun, today) : null;
  const daysUntil = isRecurring ? daysBetween(today, due) : null;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "14px 16px 14px 16px", borderBottom: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${q.color}` }}>
      {isRecurring && <CounterBadge days={daysUntil} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "14.5px", color: COLORS.text, lineHeight: "1.4", wordBreak: "break-word" }}>{template.text}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "10px", letterSpacing: "0.5px", color: q.color, textTransform: "uppercase" }}>{q.label}</span>
          {isRecurring && <span style={{ fontSize: "10px", color: COLORS.dim }}>· {describeRecurrence(template.recurring)}</span>}
          {template.tags.map((tid) => {
            const tag = tagById(tid);
            return tag ? <TagChip key={tid} tag={tag} small /> : null;
          })}
        </div>
      </div>
      <button
        onClick={() => onRun(template)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          background: COLORS.amber,
          border: "none",
          color: COLORS.bg,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "11.5px",
          fontWeight: 600,
          padding: "7px 11px",
          borderRadius: "6px",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <Play size={11} fill={COLORS.bg} />
        run
      </button>
      <span onClick={() => onDelete(template.id)} style={{ cursor: "pointer", flexShrink: 0, paddingTop: "4px" }}>
        <X size={13} color={COLORS.dim} />
      </span>
    </div>
  );
}

// Running a template creates a real task in the shared task store — see
// ARCHITECTURE.md §5 ("writes: tasks (on run), templates").
export default function TemplatesView() {
  const { tags, loading: tagsLoading } = useTags();
  const { addTask } = useTasks();
  const { templates, loading: templatesLoading, addTemplate, removeTemplate, markRunToday } = useTemplates();
  const [runLog, setRunLog] = useState([]);
  const [building, setBuilding] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [draftUrgent, setDraftUrgent] = useState(false);
  const [draftImportant, setDraftImportant] = useState(false);
  const [draftRecurring, setDraftRecurring] = useState(false);
  const [draftFreq, setDraftFreq] = useState("daily");
  const [draftWeekDays, setDraftWeekDays] = useState([0]);
  const [draftMonthDay, setDraftMonthDay] = useState(1);
  const [draftTags, setDraftTags] = useState([]);
  const [filterTags, setFilterTags] = usePersistentState("manifest.templates.filterTags", []);
  const [groupByTag, setGroupByTag] = usePersistentState("manifest.templates.groupByTag", false);
  const textRef = useRef(null);
  const now = useClock();
  const today = startOfToday();

  useEffect(() => {
    if (building && textRef.current) textRef.current.focus();
  }, [building]);

  const tagById = (id) => tags.find((t) => t.id === id);

  const runTemplate = (template) => {
    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    addTask({ text: template.text, urgent: template.urgent, important: template.important, tags: template.tags });
    setRunLog((prev) => [{ id: crypto.randomUUID(), text: template.text, time }, ...prev].slice(0, 5));
    if (template.recurring) markRunToday(template.id);
  };

  const toggleWeekDay = (d) => {
    setDraftWeekDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const toggleDraftTag = (id) => {
    setDraftTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleFilterTag = (id) => {
    setFilterTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const cancelBuild = () => {
    setBuilding(false);
    setTextDraft("");
    setDraftUrgent(false);
    setDraftImportant(false);
    setDraftRecurring(false);
    setDraftFreq("daily");
    setDraftWeekDays([0]);
    setDraftMonthDay(1);
    setDraftTags([]);
  };

  const saveTemplate = () => {
    const trimmed = textDraft.trim();
    if (!trimmed) return;
    let recurring = null;
    if (draftRecurring) {
      if (draftFreq === "daily") recurring = { type: "daily" };
      else if (draftFreq === "weekly") recurring = { type: "weekly", days: draftWeekDays.length ? draftWeekDays : [0] };
      else if (draftFreq === "monthly") recurring = { type: "monthly", day: draftMonthDay };
    }
    addTemplate({ text: trimmed, urgent: draftUrgent, important: draftImportant, recurring, tags: draftTags });
    cancelBuild();
  };

  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dataLoading = tagsLoading || templatesLoading;

  const filtered = filterTags.length === 0 ? templates : templates.filter((t) => t.tags.some((tid) => filterTags.includes(tid)));

  let groups = null;
  if (groupByTag) {
    groups = tags.map((tag) => ({ tag, items: filtered.filter((t) => t.tags[0] === tag.id) })).filter((g) => g.items.length > 0);
    const untagged = filtered.filter((t) => t.tags.length === 0);
    if (untagged.length > 0) groups.push({ tag: null, items: untagged });
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
      <div style={{ width: "100%", maxWidth: "420px", padding: `0 0 ${100 + NAV_HEIGHT}px 0` }}>
        {/* Header */}
        <div style={{ padding: "28px 20px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", marginBottom: "6px" }}>
            {dateStr} · {timeStr}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600, color: COLORS.amber, letterSpacing: "0.5px" }}>
            ~/templates
          </div>
          <div style={{ fontSize: "12px", color: COLORS.dim, marginTop: "4px" }}>
            {dataLoading ? "loading…" : `${templates.length} saved · ${templates.filter((t) => t.recurring).length} recurring`}
          </div>
        </div>

        {/* Tag filter bar */}
        <div className="filter-scroll" style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
          {tags.map((tag) => (
            <TagPickerChip key={tag.id} tag={tag} active={filterTags.includes(tag.id)} onClick={() => toggleFilterTag(tag.id)} />
          ))}
          <span style={{ flex: 1 }} />
          <button
            onClick={() => setGroupByTag((v) => !v)}
            style={{
              background: groupByTag ? COLORS.amber : "transparent",
              border: `1px solid ${groupByTag ? COLORS.amber : COLORS.border}`,
              color: groupByTag ? COLORS.bg : COLORS.dim,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10.5px",
              fontWeight: groupByTag ? 600 : 400,
              padding: "6px 10px",
              borderRadius: "6px",
              cursor: "pointer",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            group by tag
          </button>
        </div>

        {/* List */}
        <div>
          {groupByTag
            ? groups.map((group) => (
                <div key={group.tag ? group.tag.id : "untagged"}>
                  <div
                    style={{
                      padding: "8px 20px",
                      fontSize: "10.5px",
                      letterSpacing: "0.5px",
                      color: group.tag ? group.tag.color : COLORS.dim,
                      background: COLORS.panel,
                      borderBottom: `1px solid ${COLORS.border}`,
                      textTransform: "uppercase",
                    }}
                  >
                    {group.tag ? group.tag.name : "untagged"}
                  </div>
                  {group.items.map((t) => (
                    <TemplateRow key={t.id} template={t} today={today} tagById={tagById} onRun={runTemplate} onDelete={removeTemplate} />
                  ))}
                </div>
              ))
            : filtered.map((t) => <TemplateRow key={t.id} template={t} today={today} tagById={tagById} onRun={runTemplate} onDelete={removeTemplate} />)}

          {!dataLoading && templates.length === 0 && !building && (
            <div style={{ padding: "40px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>
              // no templates yet
            </div>
          )}
        </div>

        {/* Run log */}
        {runLog.length > 0 && (
          <div style={{ padding: "16px 20px 0" }}>
            <div style={{ fontSize: "10px", color: COLORS.dim, letterSpacing: "1px", marginBottom: "8px" }}>recent runs</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {runLog.map((r) => (
                <div key={r.id} style={{ fontSize: "11.5px", color: COLORS.dim }}>
                  <span style={{ color: COLORS.sage }}>$</span> added '{r.text}' · {r.time}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Builder panel */}
        {building && (
          <div style={{ margin: "16px 16px 0", padding: "14px 16px", border: `1px solid ${COLORS.borderBright}`, borderRadius: "8px", background: COLORS.panel }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ color: COLORS.amber, fontSize: "14px", flexShrink: 0 }}>{">"}</span>
              <input
                ref={textRef}
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelBuild();
                }}
                placeholder="template task text"
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
                <Toggle value={draftUrgent} onChange={setDraftUrgent} leftLabel="not urgent" rightLabel="urgent" />
              </div>
              <div style={{ flex: 1 }}>
                <Toggle value={draftImportant} onChange={setDraftImportant} leftLabel="not important" rightLabel="important" />
              </div>
            </div>

            <div style={{ marginBottom: draftRecurring ? "12px" : "14px" }}>
              <Toggle value={draftRecurring} onChange={setDraftRecurring} leftLabel="one-off" rightLabel="recurring" />
            </div>

            {draftRecurring && (
              <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: "6px", padding: "10px", marginBottom: "14px" }}>
                <div style={{ marginBottom: "10px" }}>
                  <Segmented value={draftFreq} onChange={setDraftFreq} options={FREQ_OPTIONS} />
                </div>

                {draftFreq === "weekly" && (
                  <div style={{ display: "flex", gap: "4px" }}>
                    {DAY_LABELS.map((label, i) => {
                      const active = draftWeekDays.includes(i);
                      return (
                        <span
                          key={i}
                          onClick={() => toggleWeekDay(i)}
                          style={{
                            flex: 1,
                            textAlign: "center",
                            fontSize: "10.5px",
                            padding: "6px 0",
                            borderRadius: "5px",
                            background: active ? COLORS.amber : "transparent",
                            color: active ? COLORS.bg : COLORS.dim,
                            border: `1px solid ${active ? COLORS.amber : COLORS.border}`,
                            fontWeight: active ? 600 : 400,
                            cursor: "pointer",
                          }}
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {draftFreq === "monthly" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11.5px", color: COLORS.dim }}>day of month</span>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={draftMonthDay}
                      onChange={(e) => setDraftMonthDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                      style={{
                        width: "56px",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: "5px",
                        padding: "5px 8px",
                        fontSize: "13px",
                        background: "transparent",
                        color: COLORS.text,
                        fontFamily: "'IBM Plex Mono', monospace",
                        caretColor: COLORS.amber,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
              {tags.map((tag) => (
                <TagPickerChip key={tag.id} tag={tag} active={draftTags.includes(tag.id)} onClick={() => toggleDraftTag(tag.id)} />
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={cancelBuild}
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
                onClick={saveTemplate}
                disabled={!textDraft.trim()}
                style={{
                  background: textDraft.trim() ? COLORS.amber : COLORS.border,
                  border: "none",
                  color: textDraft.trim() ? COLORS.bg : COLORS.dim,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  padding: "7px 14px",
                  borderRadius: "6px",
                  cursor: textDraft.trim() ? "pointer" : "default",
                }}
              >
                save
              </button>
            </div>
          </div>
        )}

        {/* FAB */}
        {!building && (
          <button
            className="fab"
            onClick={() => setBuilding(true)}
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
