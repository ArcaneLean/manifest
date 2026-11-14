// Add/edit a pursuit — see ARCHITECTURE.md §7 ("Hobbies"). Every field in
// one sheet, including its items (planned work, features, the books of a
// series): the checkbox toggles todo ↔ done, tapping an item opens its
// status, note, order and remove controls.
import { useEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown, X, ExternalLink } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { Segmented } from "../../components/Segmented.jsx";
import { ConfirmDialog } from "../../components/ConfirmDialog.jsx";
import { STATUSES, ITEM_STATUSES, kindSuggestions, addItem, updateItem, toggleItem, removeItem, moveItem, itemTally } from "../../lib/hobbies/model.js";
import { PickChip, primaryBtnStyle, secondaryBtnStyle, disabledStyle, MONO } from "../hours/ui.jsx";
import { Sheet, Field, fieldStyle } from "../work/ui.jsx";

const iconBtn = { display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", background: "none", border: `1px solid ${COLORS.border}`, borderRadius: "6px", cursor: "pointer" };

const ITEM_MARKS = { todo: "[ ]", doing: "[>]", done: "[×]", dropped: "[-]" };
const ITEM_COLORS = { todo: COLORS.amber, doing: COLORS.amber, done: COLORS.sage, dropped: COLORS.dim };

// `pursuit` is an existing record, or `{ isNew: true, ...defaults }`.
export function PursuitSheet({ pursuit, store, onClose }) {
  const { pursuits, savePursuit, removePursuit } = store;
  const [title, setTitle] = useState(pursuit.title || "");
  const [kind, setKind] = useState(pursuit.kind || "");
  const [status, setStatus] = useState(pursuit.status || "idea");
  const [where, setWhere] = useState(pursuit.where || "");
  const [items, setItems] = useState(pursuit.items || []);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [openItemId, setOpenItemId] = useState(null);
  const [link, setLink] = useState(pursuit.link || "");
  const [notes, setNotes] = useState(pursuit.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    if (pursuit.isNew) titleRef.current?.focus();
  }, [pursuit.isNew]);

  const kinds = kindSuggestions(pursuits).slice(0, 8);
  const tally = itemTally(items);

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    // An item typed but not yet added with Enter still counts.
    savePursuit(pursuit, {
      title: trimmed,
      kind: kind.trim().toLowerCase(),
      status,
      where: where.trim(),
      items: addItem(items, newItemTitle),
      link: link.trim() || null,
      notes: notes.trim(),
    });
    onClose();
  };

  const submitItem = () => {
    setItems((prev) => addItem(prev, newItemTitle));
    setNewItemTitle("");
  };

  return (
    <Sheet title={pursuit.isNew ? "new hobby" : "edit hobby"} onClose={onClose}>
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
        rows={1}
        placeholder="manga, book series, project, idea…"
        aria-label="title"
        className="task-input"
        style={{ ...fieldStyle, fontSize: "14.5px", resize: "none", marginBottom: "14px" }}
      />

      <Field label="status">
        <Segmented value={status} onChange={setStatus} options={STATUSES.map((s) => ({ key: s, label: s }))} fontSize="10px" />
      </Field>

      <Field label="where I am">
        <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="ch 87 · book 2, halfway · v0.3 shipped" aria-label="where I am" style={fieldStyle} />
      </Field>

      <Field label="kind">
        <input value={kind} onChange={(e) => setKind(e.target.value)} placeholder="free text" aria-label="kind" style={{ ...fieldStyle, marginBottom: "8px" }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {kinds.map((k) => (
            <PickChip key={k} label={k} color={COLORS.amberDim} active={kind.trim().toLowerCase() === k} onClick={() => setKind(kind.trim().toLowerCase() === k ? "" : k)} />
          ))}
        </div>
      </Field>

      <Field label={`items${tally.total ? ` · ${tally.done}/${tally.total}` : ""} — planned work, features, books`}>
        {items.map((item, index) => {
          const isOpen = openItemId === item.id;
          return (
            <div key={item.id} style={{ borderBottom: isOpen ? `1px solid ${COLORS.border}` : "none", paddingBottom: isOpen ? "8px" : 0, marginBottom: isOpen ? "6px" : 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "4px 0" }}>
                <span
                  onClick={() => setItems((prev) => toggleItem(prev, item.id))}
                  role="checkbox"
                  aria-checked={item.status === "done"}
                  aria-label={`toggle ${item.title}`}
                  style={{ color: ITEM_COLORS[item.status], fontSize: "12.5px", cursor: "pointer", userSelect: "none", flexShrink: 0 }}
                >
                  {ITEM_MARKS[item.status] || "[ ]"}
                </span>
                <span
                  onClick={() => setOpenItemId(isOpen ? null : item.id)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: "12.5px",
                    cursor: "pointer",
                    wordBreak: "break-word",
                    color: item.status === "done" || item.status === "dropped" ? COLORS.dim : COLORS.text,
                    textDecorationLine: item.status === "dropped" ? "line-through" : "none",
                  }}
                >
                  {item.title}
                  {item.note && !isOpen && <span style={{ color: COLORS.dim }}> · {item.note}</span>}
                </span>
              </div>
              {isOpen && (
                <div style={{ paddingLeft: "30px", display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                  <input
                    value={item.title}
                    onChange={(e) => setItems((prev) => updateItem(prev, item.id, { title: e.target.value }))}
                    aria-label="item title"
                    style={fieldStyle}
                  />
                  <Segmented
                    value={item.status}
                    onChange={(s) => setItems((prev) => updateItem(prev, item.id, { status: s }))}
                    options={ITEM_STATUSES.map((s) => ({ key: s, label: s }))}
                    fontSize="10.5px"
                  />
                  <input
                    value={item.note}
                    onChange={(e) => setItems((prev) => updateItem(prev, item.id, { note: e.target.value }))}
                    placeholder="note"
                    aria-label="item note"
                    style={fieldStyle}
                  />
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <button onClick={() => setItems((prev) => moveItem(prev, index, index - 1))} disabled={index === 0} style={disabledStyle(iconBtn, index === 0)} aria-label="move up">
                      <ChevronUp size={13} color={COLORS.dim} />
                    </button>
                    <button
                      onClick={() => setItems((prev) => moveItem(prev, index, index + 1))}
                      disabled={index === items.length - 1}
                      style={disabledStyle(iconBtn, index === items.length - 1)}
                      aria-label="move down"
                    >
                      <ChevronDown size={13} color={COLORS.dim} />
                    </button>
                    <span style={{ flex: 1 }} />
                    <button
                      onClick={() => {
                        setItems((prev) => removeItem(prev, item.id));
                        setOpenItemId(null);
                      }}
                      style={{ ...iconBtn, width: "auto", padding: "0 8px", gap: "4px", color: COLORS.dim, fontFamily: MONO, fontSize: "11px" }}
                      aria-label="remove item"
                    >
                      <X size={12} color={COLORS.dim} /> remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <input
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitItem();
          }}
          placeholder="+ add item (enter)"
          aria-label="new item"
          style={{ ...fieldStyle, marginTop: items.length ? "6px" : 0 }}
        />
      </Field>

      <Field label="link">
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="repo / reader / shop url" aria-label="link" style={fieldStyle} />
          {/^https?:\/\//.test(link.trim()) && (
            <a href={link.trim()} target="_blank" rel="noreferrer" aria-label="open link" style={{ display: "flex" }}>
              <ExternalLink size={15} color={COLORS.dim} />
            </a>
          )}
        </div>
      </Field>

      <Field label="notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} aria-label="notes" style={{ ...fieldStyle, resize: "vertical" }} />
      </Field>

      <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
        {!pursuit.isNew ? (
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
            {pursuit.isNew ? "add" : "save"}
          </button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="delete this hobby?"
          message={`"${pursuit.title}" and its items are removed for good. Use status "dropped" instead to keep it on record.`}
          confirmLabel="delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            removePursuit(pursuit.id);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
