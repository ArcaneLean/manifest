import { useRef, useState, useEffect } from "react";
import { Plus, X, CheckCircle2, Hourglass, Flag } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { QUADRANTS, quadrantFor } from "../lib/quadrant.js";
import { isScheduled } from "../lib/taskDates.js";
import { toISO, formatShortDate } from "../lib/dateUtils.js";
import { useClock } from "../hooks/useClock.js";
import { useTags } from "../hooks/useTags.js";
import { useTasks } from "../hooks/useTasks.js";
import { useShowCompleted } from "../hooks/useShowCompleted.js";
import { useShowScheduled } from "../hooks/useShowScheduled.js";
import { usePersistentState } from "../hooks/usePersistentState.js";
import { Checkbox } from "../components/Checkbox.jsx";
import { Toggle } from "../components/Toggle.jsx";
import { SortSwitch } from "../components/SortSwitch.jsx";
import { CompletedToggle } from "../components/CompletedToggle.jsx";
import { ScheduledToggle } from "../components/ScheduledToggle.jsx";
import { TagChip, TagPickerChip } from "../components/TagChip.jsx";
import { NAV_HEIGHT } from "../components/NavBar.jsx";

export default function TasksView() {
  const { tags, loading: tagsLoading } = useTags();
  const { tasks, loading: tasksLoading, toggleTask, addTask, removeTask } = useTasks();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftUrgent, setDraftUrgent] = useState(false);
  const [draftImportant, setDraftImportant] = useState(false);
  const [draftTags, setDraftTags] = useState([]);
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftDueDate, setDraftDueDate] = useState("");
  const [sortBy, setSortBy] = usePersistentState("manifest.tasks.sortBy", "added");
  const [filterTags, setFilterTags] = usePersistentState("manifest.tasks.filterTags", []);
  const [showCompleted, setShowCompleted] = useShowCompleted();
  const [showScheduled, setShowScheduled] = useShowScheduled();
  const inputRef = useRef(null);
  const now = useClock();

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  const tagById = (id) => tags.find((t) => t.id === id);

  const toggleDraftTag = (id) => {
    setDraftTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleFilterTag = (id) => {
    setFilterTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      addTask({
        text: trimmed,
        urgent: draftUrgent,
        important: draftImportant,
        tags: draftTags,
        startDate: draftStartDate || undefined,
        dueDate: draftDueDate || undefined,
      });
    }
    setDraft("");
    setDraftUrgent(false);
    setDraftImportant(false);
    setDraftTags([]);
    setDraftStartDate("");
    setDraftDueDate("");
    setAdding(false);
  };

  const cancelDraft = () => {
    setDraft("");
    setDraftUrgent(false);
    setDraftImportant(false);
    setDraftTags([]);
    setDraftStartDate("");
    setDraftDueDate("");
    setAdding(false);
  };

  const remaining = tasks.filter((t) => !t.done).length;
  const dateStr = now
    .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })
    .toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  const todayISO = toISO(now);

  const visibleTasks = tasks.filter(
    (t) => (showCompleted || !t.done) && (showScheduled || !isScheduled(t, todayISO))
  );

  const filteredTasks =
    filterTags.length === 0
      ? visibleTasks
      : visibleTasks.filter((t) => t.tags.some((tid) => filterTags.includes(tid)));

  let sortedTasks = filteredTasks;
  if (sortBy === "priority") {
    sortedTasks = [...filteredTasks].sort((a, b) => {
      const rankA = QUADRANTS[quadrantFor(a.urgent, a.important)].rank;
      const rankB = QUADRANTS[quadrantFor(b.urgent, b.important)].rank;
      return rankA - rankB;
    });
  } else if (sortBy === "due") {
    sortedTasks = [...filteredTasks].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }

  // grouped-by-tag view: each task grouped under its first tag; untagged tasks last
  let tagGroups = null;
  if (sortBy === "tag") {
    tagGroups = tags
      .map((tag) => ({ tag, tasks: filteredTasks.filter((t) => t.tags[0] === tag.id) }))
      .filter((g) => g.tasks.length > 0);
    const untagged = filteredTasks.filter((t) => t.tags.length === 0);
    if (untagged.length > 0) tagGroups.push({ tag: null, tasks: untagged });
  }

  const renderTaskRow = (t) => {
    const qKey = quadrantFor(t.urgent, t.important);
    const q = QUADRANTS[qKey];
    const scheduled = isScheduled(t, todayISO);
    const overdue = t.dueDate && !t.done && t.dueDate < todayISO;
    return (
      <div
        key={t.id}
        className="task-row"
        onClick={() => toggleTask(t.id)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "14px 20px 14px 16px",
          borderBottom: `1px solid ${COLORS.border}`,
          borderLeft: `3px solid ${t.done ? COLORS.border : q.color}`,
          cursor: "pointer",
        }}
      >
        <Checkbox done={t.done} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: "14.5px",
              lineHeight: "1.5",
              color: t.done ? COLORS.dim : COLORS.text,
              textDecorationLine: t.done ? "line-through" : "none",
              textDecorationColor: COLORS.dim,
              wordBreak: "break-word",
            }}
          >
            {t.text}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "10px",
                letterSpacing: "0.5px",
                color: t.done ? COLORS.dim : q.color,
                textTransform: "uppercase",
              }}
            >
              {q.label}
            </span>
            {t.tags.map((tid) => {
              const tag = tagById(tid);
              return tag ? <TagChip key={tid} tag={tag} small /> : null;
            })}
            {t.dueDate && (
              <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "10px", color: overdue ? COLORS.amber : COLORS.dim }}>
                <Flag size={10} />
                due {formatShortDate(t.dueDate)}
              </span>
            )}
            {scheduled && (
              <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "10px", color: COLORS.dim }}>
                <Hourglass size={10} />
                starts {formatShortDate(t.startDate)}
              </span>
            )}
          </div>
        </div>
        <span
          onClick={(e) => {
            e.stopPropagation();
            removeTask(t.id);
          }}
          style={{ cursor: "pointer", flexShrink: 0, paddingTop: "2px" }}
        >
          <X size={14} color={COLORS.dim} />
        </span>
      </div>
    );
  };

  const dataLoading = tagsLoading || tasksLoading;

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
            ~/tasks
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "10px" }}>
            <div style={{ fontSize: "12px", color: COLORS.dim }}>
              {dataLoading ? "loading…" : `${remaining} open · ${tasks.length - remaining} done`}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CompletedToggle value={showCompleted} onChange={setShowCompleted} />
              <ScheduledToggle value={showScheduled} onChange={setShowScheduled} />
              <SortSwitch value={sortBy} onChange={setSortBy} />
            </div>
          </div>
        </div>

        {/* Tag filter bar */}
        <div
          className="filter-scroll"
          style={{ display: "flex", gap: "6px", padding: "10px 20px", borderBottom: `1px solid ${COLORS.border}` }}
        >
          {tags.map((tag) => (
            <TagPickerChip key={tag.id} tag={tag} active={filterTags.includes(tag.id)} onClick={() => toggleFilterTag(tag.id)} />
          ))}
        </div>

        {/* Task list */}
        <div>
          {sortBy === "tag"
            ? tagGroups.map((group) => (
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
                  {group.tasks.map(renderTaskRow)}
                </div>
              ))
            : sortedTasks.map(renderTaskRow)}

          {/* Inline add row */}
          {adding && (
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.borderBright}`, background: COLORS.panel }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span style={{ color: COLORS.amber, fontSize: "15px", width: "30px", flexShrink: 0 }}>{"[ ]"}</span>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitDraft();
                    if (e.key === "Escape") cancelDraft();
                  }}
                  placeholder="new task"
                  className="task-input"
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: COLORS.text,
                    caretColor: COLORS.amber,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "14.5px",
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
                      fontSize: "12px",
                      colorScheme: "dark",
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
                      fontSize: "12px",
                      colorScheme: "dark",
                      flex: 1,
                      minWidth: 0,
                      padding: "6px 0",
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
                {tags.map((tag) => (
                  <TagPickerChip key={tag.id} tag={tag} active={draftTags.includes(tag.id)} onClick={() => toggleDraftTag(tag.id)} />
                ))}
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

          {!dataLoading && tasks.length === 0 && !adding && (
            <div style={{ padding: "40px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>
              // no tasks logged yet
            </div>
          )}

          {!dataLoading && tasks.length > 0 && filteredTasks.length === 0 && !showCompleted && !adding && (
            <div style={{ padding: "40px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>
              // all done — tap <CheckCircle2 size={11} style={{ verticalAlign: "middle" }} /> to see completed tasks
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
              boxShadow: `0 0 20px rgba(255,176,0,0.35), 0 4px 12px rgba(0,0,0,0.5)`,
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
