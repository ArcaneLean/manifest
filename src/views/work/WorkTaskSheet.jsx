// Add/edit a work task — see ARCHITECTURE.md §7 ("Work tasks"). Every field
// in one sheet; status changes other than todo ↔ done happen here.
import { useEffect, useRef, useState } from "react";
import { Hourglass, Flag, Minus, Plus, X, ExternalLink } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { Segmented } from "../../components/Segmented.jsx";
import { TagPickerChip } from "../../components/TagChip.jsx";
import { ConfirmDialog } from "../../components/ConfirmDialog.jsx";
import { STATUSES, PRIORITY_KEYS, PRIORITIES, DEFAULT_PRIORITY, stepEffort } from "../../lib/worktasks/model.js";
import { PickChip, BracketCheck, primaryBtnStyle, secondaryBtnStyle, disabledStyle, fmt, MONO } from "../hours/ui.jsx";
import { Sheet, Field, fieldStyle } from "./ui.jsx";

const stepBtn = {
  width: "30px",
  height: "30px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: `1px solid ${COLORS.border}`,
  borderRadius: "6px",
  cursor: "pointer",
};

// `task` is an existing record, or `{ isNew: true, ...defaults }` for a new one.
export function WorkTaskSheet({ task, store, onClose }) {
  const { workProjects, tags, actual, saveTask, removeTask } = store;
  const [title, setTitle] = useState(task.title || "");
  const [projectId, setProjectId] = useState(task.projectId ?? null);
  const [status, setStatus] = useState(task.status || "todo");
  const [waitingOn, setWaitingOn] = useState(task.waitingOn || "");
  const [priority, setPriority] = useState(task.priority || DEFAULT_PRIORITY);
  const [effortMin, setEffortMin] = useState(task.effortMin ?? null);
  const [startDate, setStartDate] = useState(task.startDate || "");
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [hardDeadline, setHardDeadline] = useState(!!task.hardDeadline);
  const [link, setLink] = useState(task.link || "");
  const [notes, setNotes] = useState(task.notes || "");
  const [checklist, setChecklist] = useState(task.checklist || []);
  const [newItem, setNewItem] = useState("");
  const [taskTags, setTaskTags] = useState(task.tags || []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    if (task.isNew) titleRef.current?.focus();
  }, [task.isNew]);

  // Archived/done projects stay pickable only if the task is already on one.
  const projectOptions = workProjects.filter((p) => (!p.archived && p.status !== "done") || p.id === task.projectId);

  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    setChecklist((prev) => [...prev, { id: crypto.randomUUID(), text, done: false }]);
    setNewItem("");
  };

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    // An item typed but not yet added with Enter still counts.
    const items = newItem.trim() ? [...checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }] : checklist;
    saveTask(task, {
      title: trimmed,
      projectId,
      status,
      waitingOn: status === "waiting" ? waitingOn.trim() || null : null,
      priority,
      effortMin,
      startDate: startDate || null,
      dueDate: dueDate || null,
      hardDeadline: !!dueDate && hardDeadline,
      link: link.trim() || null,
      notes: notes.trim(),
      checklist: items,
      tags: taskTags,
    });
    onClose();
  };

  const spent = task.isNew ? 0 : actual[task.id] || 0;

  return (
    <Sheet title={task.isNew ? "new work task" : "edit work task"} onClose={onClose}>
      <textarea
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
          }
        }}
        rows={2}
        placeholder="what needs doing"
        className="task-input"
        style={{ ...fieldStyle, fontSize: "14.5px", resize: "none", marginBottom: "14px" }}
      />

      <Field label="project">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          <PickChip label="inbox" color={COLORS.dim} active={projectId === null} onClick={() => setProjectId(null)} />
          {projectOptions.map((p) => (
            <PickChip key={p.id} label={p.name} color={p.color} active={projectId === p.id} onClick={() => setProjectId(p.id)} />
          ))}
        </div>
      </Field>

      <Field label="status">
        <Segmented value={status} onChange={setStatus} options={STATUSES.map((s) => ({ key: s, label: s }))} fontSize="10.5px" />
        {status === "waiting" && (
          <input value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} placeholder="waiting on… (person, review, reply)" style={{ ...fieldStyle, marginTop: "8px" }} />
        )}
      </Field>

      <div style={{ display: "flex", gap: "12px" }}>
        <Field label="priority" style={{ flex: 1 }}>
          <Segmented value={priority} onChange={setPriority} options={PRIORITY_KEYS.map((k) => ({ key: k, label: PRIORITIES[k].label }))} fontSize="10.5px" />
        </Field>
        <Field label="effort" style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button onClick={() => setEffortMin((m) => stepEffort(m, -1))} style={stepBtn} aria-label="less effort">
              <Minus size={13} color={COLORS.dim} />
            </button>
            <span style={{ fontSize: "12.5px", minWidth: "54px", textAlign: "center", color: effortMin ? COLORS.text : COLORS.dim }}>
              {effortMin ? fmt(effortMin) : "—"}
            </span>
            <button onClick={() => setEffortMin((m) => stepEffort(m, 1))} style={stepBtn} aria-label="more effort">
              <Plus size={13} color={COLORS.dim} />
            </button>
          </div>
        </Field>
      </div>
      {spent > 0 && (
        <div style={{ fontSize: "11px", color: COLORS.dim, margin: "-6px 0 14px" }}>
          worked so far <span style={{ color: effortMin && spent > effortMin ? COLORS.amber : COLORS.text }}>{fmt(spent)}</span>
          {effortMin ? ` of ${fmt(effortMin)} estimated` : ""}
        </div>
      )}

      <Field label="start · due">
        <div style={{ display: "flex", gap: "10px" }}>
          <DateInput icon={Hourglass} value={startDate} onChange={setStartDate} label="start date" />
          <DateInput icon={Flag} value={dueDate} onChange={setDueDate} label="due date" />
        </div>
        {dueDate && (
          <div style={{ marginTop: "8px" }}>
            <BracketCheck checked={hardDeadline} onChange={setHardDeadline} label="hard deadline (fixed, external)" />
          </div>
        )}
      </Field>

      <Field label="checklist">
        {checklist.map((item) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "3px 0" }}>
            <span
              onClick={() => setChecklist((prev) => prev.map((c) => (c.id === item.id ? { ...c, done: !c.done } : c)))}
              style={{ color: item.done ? COLORS.sage : COLORS.amber, fontSize: "12.5px", cursor: "pointer", userSelect: "none" }}
            >
              {item.done ? "[×]" : "[ ]"}
            </span>
            <span style={{ flex: 1, fontSize: "12.5px", color: item.done ? COLORS.dim : COLORS.text, textDecorationLine: item.done ? "line-through" : "none" }}>{item.text}</span>
            <span onClick={() => setChecklist((prev) => prev.filter((c) => c.id !== item.id))} style={{ cursor: "pointer" }} aria-label="remove item">
              <X size={13} color={COLORS.dim} />
            </span>
          </div>
        ))}
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addItem();
          }}
          placeholder="+ add step (enter)"
          style={{ ...fieldStyle, marginTop: checklist.length ? "6px" : 0 }}
        />
      </Field>

      <Field label="link">
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="ticket / PR / doc url" style={fieldStyle} />
          {/^https?:\/\//.test(link.trim()) && (
            <a href={link.trim()} target="_blank" rel="noreferrer" aria-label="open link" style={{ display: "flex" }}>
              <ExternalLink size={15} color={COLORS.dim} />
            </a>
          )}
        </div>
      </Field>

      <Field label="notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...fieldStyle, resize: "vertical" }} />
      </Field>

      {tags.length > 0 && (
        <Field label="tags">
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {tags.map((tag) => (
              <TagPickerChip
                key={tag.id}
                tag={tag}
                active={taskTags.includes(tag.id)}
                onClick={() => setTaskTags((prev) => (prev.includes(tag.id) ? prev.filter((x) => x !== tag.id) : [...prev, tag.id]))}
              />
            ))}
          </div>
        </Field>
      )}

      <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
        {!task.isNew ? (
          <button onClick={() => setConfirmDelete(true)} style={{ background: "none", border: "none", color: COLORS.dim, fontFamily: MONO, fontSize: "12px", cursor: "pointer", padding: "7px 4px" }}>
            delete
          </button>
        ) : (
          <span />
        )}
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onClose} style={secondaryBtnStyle}>
            cancel
          </button>
          <button onClick={save} disabled={!title.trim()} style={disabledStyle(primaryBtnStyle, !title.trim())}>
            {task.isNew ? "add" : "save"}
          </button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="delete this task?"
          message={`"${task.title}" is removed for good. Use status "dropped" instead to keep it on record.${spent > 0 ? " Hours already logged on it stay in Hours." : ""}`}
          confirmLabel="delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            removeTask(task.id);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

function DateInput({ icon: Icon, value, onChange, label }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px", border: `1px solid ${COLORS.border}`, borderRadius: "6px", padding: "0 8px", minWidth: 0 }}>
      <Icon size={12} color={COLORS.dim} />
      <input
        type="date"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ background: "transparent", border: "none", outline: "none", color: COLORS.text, fontFamily: MONO, fontSize: "12px", colorScheme: "dark", flex: 1, minWidth: 0, padding: "7px 0" }}
      />
      {value && (
        <span onClick={() => onChange("")} style={{ cursor: "pointer", display: "flex" }} aria-label={`clear ${label}`}>
          <X size={12} color={COLORS.dim} />
        </span>
      )}
    </div>
  );
}
