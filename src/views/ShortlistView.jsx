import { useEffect, useRef, useState } from "react";
import { X, Check, GripVertical, RotateCcw, ListTodo, Flame } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { Segmented } from "../components/Segmented.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { TagChip } from "../components/TagChip.jsx";
import { Checkbox } from "../components/Checkbox.jsx";
import { usePersistentState } from "../hooks/usePersistentState.js";
import { useShortlist } from "../hooks/useShortlist.js";
import { useTags } from "../hooks/useTags.js";
import { TOPBAR_HEIGHT } from "../components/TopBar.jsx";

const TABS = [
  { key: "wont", label: "won't do" },
  { key: "could", label: "could do" },
  { key: "want", label: "want to do" },
];

// Which bucket each button on a row (or each tag group's bulk button) moves
// toward — omitted at either edge since there's nowhere further to go (see
// ARCHITECTURE.md §7 "Shortlist").
function stepTargets(bucket) {
  if (bucket === "wont") return { forward: "could" };
  if (bucket === "want") return { back: "could" };
  return { back: "wont", forward: "want" };
}

// Reorders `list` by moving the item at `from` to `to`.
function arrayMove(list, from, to) {
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export default function ShortlistView() {
  const [activeTab, setActiveTab] = usePersistentState("manifest.shortlist.active", "could");
  const { loading, bucketItems, moveItem, completeItem, moveTag, reorderBucket, reset } = useShortlist();
  const { tags } = useTags();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [rows, setRows] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const rowRefs = useRef([]);
  const draggingRef = useRef(false);

  const tagById = (id) => tags.find((t) => t.id === id);

  const canonical = bucketItems(activeTab);

  // Mirrors the canonical (persisted) order into local state for rendering
  // and live drag feedback — skipped mid-drag so an in-flight reorder isn't
  // clobbered by the effect re-running (e.g. from an unrelated task edit).
  useEffect(() => {
    if (draggingRef.current) return;
    setRows(canonical);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, canonical.map((r) => r.id).join(",")]);

  const { back, forward } = stepTargets(activeTab);

  // Tags present on this bucket's rows, in the order they first appear —
  // drives the bulk move bar below the tab switcher.
  const presentTags = [];
  const seenTagIds = new Set();
  rows.forEach((r) => {
    (r.tags || []).forEach((tid) => {
      if (!seenTagIds.has(tid)) {
        seenTagIds.add(tid);
        const tag = tagById(tid);
        if (tag) presentTags.push(tag);
      }
    });
  });

  const handlePointerDown = (e, index) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragIndex(index);
  };

  const handlePointerMove = (e) => {
    if (dragIndex === null) return;
    const y = e.clientY;
    const midpoints = rowRefs.current.map((el) => {
      if (!el) return Infinity;
      const rect = el.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
    let newIndex = midpoints.findIndex((m) => y < m);
    if (newIndex === -1) newIndex = rows.length - 1;
    if (newIndex !== dragIndex) {
      setRows((prev) => arrayMove(prev, dragIndex, newIndex));
      setDragIndex(newIndex);
    }
  };

  const handlePointerUp = (e) => {
    if (dragIndex === null) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    draggingRef.current = false;
    setDragIndex(null);
    reorderBucket(activeTab, rows.map((r) => r.id));
  };

  const doReset = () => {
    reset();
    setConfirmingReset(false);
  };

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
        <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <div style={{ fontSize: "20px", fontWeight: 600, color: COLORS.amber, letterSpacing: "0.5px" }}>~/shortlist</div>
            <button
              onClick={() => setConfirmingReset(true)}
              title="reset all to could do"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: `1px solid ${COLORS.border}`,
                borderRadius: "6px",
                color: COLORS.dim,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "11px",
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              <RotateCcw size={12} strokeWidth={2} /> reset
            </button>
          </div>
          <Segmented value={activeTab} onChange={setActiveTab} options={TABS} />
        </div>

        {presentTags.length > 0 && (
          <div
            className="filter-scroll"
            style={{ display: "flex", gap: "8px", padding: "10px 20px", borderBottom: `1px solid ${COLORS.border}` }}
          >
            {presentTags.map((tag) => (
              <div
                key={tag.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  flexShrink: 0,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  padding: "3px 4px 3px 8px",
                }}
              >
                <TagChip tag={tag} small />
                {back && (
                  <button
                    onClick={() => moveTag(tag.id, activeTab, back)}
                    aria-label={`move all "${tag.name}" items toward won't do`}
                    title={`move all "${tag.name}" items toward won't do`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "20px",
                      height: "20px",
                      borderRadius: "5px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <X size={11} color={COLORS.danger} strokeWidth={2.25} />
                  </button>
                )}
                {forward && (
                  <button
                    onClick={() => moveTag(tag.id, activeTab, forward)}
                    aria-label={`move all "${tag.name}" items toward want to do`}
                    title={`move all "${tag.name}" items toward want to do`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "20px",
                      height: "20px",
                      borderRadius: "5px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <Check size={11} color={COLORS.sage} strokeWidth={2.25} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          {!loading && rows.length === 0 && (
            <div style={{ padding: "40px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>
              // nothing here
            </div>
          )}

          {rows.map((item, index) => {
            const isDragging = dragIndex === index;
            const Icon = item.itemType === "habit" ? Flame : ListTodo;
            const itemTags = (item.tags || []).map(tagById).filter(Boolean);
            return (
              <div
                key={item.id}
                ref={(el) => (rowRefs.current[index] = el)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "12px 16px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  background: isDragging ? COLORS.panel : "transparent",
                  position: "relative",
                  zIndex: isDragging ? 1 : 0,
                }}
              >
                <span
                  onPointerDown={(e) => handlePointerDown(e, index)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  style={{ display: "flex", cursor: "grab", touchAction: "none", flexShrink: 0, padding: "4px", margin: "-4px", marginTop: "2px" }}
                  aria-label="drag to reorder"
                >
                  <GripVertical size={14} color={COLORS.dim} />
                </span>

                {item.itemType === "task" && (
                  <span onClick={() => completeItem(item.id)} style={{ cursor: "pointer", flexShrink: 0 }} aria-label="complete task">
                    <Checkbox done={false} />
                  </span>
                )}

                <Icon size={13} color={item.itemType === "habit" ? COLORS.sage : COLORS.amberDim} strokeWidth={2} style={{ flexShrink: 0, marginTop: "3px" }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "13.5px", wordBreak: "break-word" }}>{item.text}</span>

                  {itemTags.length > 0 && (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "5px" }}>
                      {itemTags.map((tag) => (
                        <TagChip key={tag.id} tag={tag} small />
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  {back && (
                    <button
                      onClick={() => moveItem(item.id, back)}
                      aria-label="move toward won't do"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        background: "none",
                        border: `1px solid ${COLORS.border}`,
                        cursor: "pointer",
                      }}
                    >
                      <X size={14} color={COLORS.danger} strokeWidth={2.25} />
                    </button>
                  )}
                  {forward && (
                    <button
                      onClick={() => moveItem(item.id, forward)}
                      aria-label="move toward want to do"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        background: "none",
                        border: `1px solid ${COLORS.border}`,
                        cursor: "pointer",
                      }}
                    >
                      <Check size={14} color={COLORS.sage} strokeWidth={2.25} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {confirmingReset && (
        <ConfirmDialog
          title="reset shortlist?"
          message="every item in won't do and want to do moves back to could do. this can't be undone."
          confirmLabel="reset"
          onConfirm={doReset}
          onCancel={() => setConfirmingReset(false)}
        />
      )}
    </div>
  );
}
