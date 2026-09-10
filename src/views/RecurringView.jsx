import { useRef, useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { useClock } from "../hooks/useClock.js";
import { useTags } from "../hooks/useTags.js";
import { useTasks } from "../hooks/useTasks.js";
import { useTemplates } from "../hooks/useTemplates.js";
import { usePersistentState } from "../hooks/usePersistentState.js";
import { Toggle } from "../components/Toggle.jsx";
import { Segmented } from "../components/Segmented.jsx";
import { TagPickerChip } from "../components/TagChip.jsx";
import { TemplateRow } from "../components/TemplateRow.jsx";
import { TemplateEditModal } from "../components/TemplateEditModal.jsx";
import { NAV_HEIGHT } from "../components/NavBar.jsx";
import { TOPBAR_HEIGHT } from "../components/TopBar.jsx";
import { startOfToday } from "../lib/dateUtils.js";
import { DAY_LABELS } from "../lib/recurrence.js";

const FREQ_OPTIONS = [
  { key: "daily", label: "daily" },
  { key: "weekly", label: "weekly" },
  { key: "monthly", label: "monthly" },
];

const DATE_FIELD_OPTIONS = [
  { key: "due", label: "due date" },
  { key: "start", label: "start date" },
  { key: "both", label: "both" },
];

// Recurring templates, split out of TemplatesView.jsx — see ARCHITECTURE.md
// §5/§7. Each has exactly one open "anchor" task, instantiated and advanced
// automatically (ARCHITECTURE.md §7 "Recurring templates on the Calendar"),
// so rows here show a countdown badge instead of a one-off's "run" button.
export default function RecurringView() {
  const { tags, loading: tagsLoading } = useTags();
  const { tasks } = useTasks();
  const { templates, loading: templatesLoading, addTemplate, removeTemplate, updateTemplate } = useTemplates();
  const [building, setBuilding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [textDraft, setTextDraft] = useState("");
  const [draftUrgent, setDraftUrgent] = useState(false);
  const [draftImportant, setDraftImportant] = useState(false);
  const [draftFreq, setDraftFreq] = useState("daily");
  const [draftWeekDays, setDraftWeekDays] = useState([0]);
  const [draftMonthDay, setDraftMonthDay] = useState(1);
  const [draftDateField, setDraftDateField] = useState("due");
  const [draftTags, setDraftTags] = useState([]);
  const [filterTags, setFilterTags] = usePersistentState("manifest.recurring.filterTags", []);
  const [groupByTag, setGroupByTag] = usePersistentState("manifest.recurring.groupByTag", false);
  const textRef = useRef(null);
  const now = useClock();
  const today = startOfToday();

  useEffect(() => {
    if (building && textRef.current) textRef.current.focus();
  }, [building]);

  const recurringTemplates = templates.filter((t) => !!t.recurring);

  const tagById = (id) => tags.find((t) => t.id === id);
  const editingTemplate = editingId ? recurringTemplates.find((t) => t.id === editingId) : null;
  // Each open anchor's dueDate/startDate drives the counter badge — see
  // ARCHITECTURE.md §7.
  const anchorDate = (templateId) => {
    const anchor = tasks.find((t) => t.templateId === templateId && !t.done);
    return anchor?.dueDate || anchor?.startDate || null;
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
    setDraftFreq("daily");
    setDraftWeekDays([0]);
    setDraftMonthDay(1);
    setDraftDateField("due");
    setDraftTags([]);
  };

  const saveTemplate = () => {
    const trimmed = textDraft.trim();
    if (!trimmed) return;
    let recurring;
    if (draftFreq === "daily") recurring = { type: "daily" };
    else if (draftFreq === "weekly") recurring = { type: "weekly", days: draftWeekDays.length ? draftWeekDays : [0] };
    else recurring = { type: "monthly", day: draftMonthDay };
    recurring.dateField = draftDateField;
    addTemplate({ text: trimmed, urgent: draftUrgent, important: draftImportant, recurring, tags: draftTags });
    cancelBuild();
  };

  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dataLoading = tagsLoading || templatesLoading;

  const filtered = filterTags.length === 0 ? recurringTemplates : recurringTemplates.filter((t) => t.tags.some((tid) => filterTags.includes(tid)));

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
      <div style={{ width: "100%", maxWidth: "420px", padding: `${TOPBAR_HEIGHT}px 0 ${100 + NAV_HEIGHT}px 0` }}>
        {/* Header */}
        <div style={{ padding: "28px 20px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", marginBottom: "6px" }}>
            {dateStr} · {timeStr}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600, color: COLORS.amber, letterSpacing: "0.5px" }}>
            ~/recurring
          </div>
          <div style={{ fontSize: "12px", color: COLORS.dim, marginTop: "4px" }}>
            {dataLoading ? "loading…" : `${recurringTemplates.length} recurring`}
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
                    <TemplateRow key={t.id} template={t} today={today} anchorDate={anchorDate(t.id)} tagById={tagById} onDelete={removeTemplate} onEdit={setEditingId} />
                  ))}
                </div>
              ))
            : filtered.map((t) => (
                <TemplateRow key={t.id} template={t} today={today} anchorDate={anchorDate(t.id)} tagById={tagById} onDelete={removeTemplate} onEdit={setEditingId} />
              ))}

          {!dataLoading && recurringTemplates.length === 0 && !building && (
            <div style={{ padding: "40px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>
              // no recurring templates yet
            </div>
          )}
        </div>

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

              <div style={{ marginTop: "10px" }}>
                <div style={{ fontSize: "10.5px", color: COLORS.dim, marginBottom: "6px" }}>schedule sets</div>
                <Segmented value={draftDateField} onChange={setDraftDateField} options={DATE_FIELD_OPTIONS} />
              </div>
            </div>

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

        {editingTemplate && (
          <TemplateEditModal
            template={editingTemplate}
            tags={tags}
            onClose={() => setEditingId(null)}
            onSave={(updates) => {
              updateTemplate(editingTemplate.id, updates);
              setEditingId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
