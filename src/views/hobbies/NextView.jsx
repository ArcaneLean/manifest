// Hobbies' queue — see ARCHITECTURE.md §7 ("Hobbies"): what to pick up next,
// in a manual order (drag the grip). ▶ starts one.
import { useEffect, useRef, useState } from "react";
import { Play, GripVertical } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { forTab, moveItem } from "../../lib/hobbies/model.js";
import { Page, Header } from "../hours/ui.jsx";
import { Fab } from "../work/ui.jsx";
import { PursuitRow, Empty } from "./PursuitRow.jsx";

export default function NextView({ store }) {
  const { pursuits, loading, openPursuit, newPursuit, setStatus, reorder } = store;
  const canonical = forTab(pursuits, "next");
  const [rows, setRows] = useState(canonical);
  const [dragIndex, setDragIndex] = useState(null);
  const rowRefs = useRef([]);
  const draggingRef = useRef(false);

  // Same drag pattern as ShortlistView: mirror the persisted order into
  // local state, except mid-drag.
  useEffect(() => {
    if (draggingRef.current) return;
    setRows(canonical);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pursuits]);

  const onPointerDown = (e, index) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragIndex(index);
  };
  const onPointerMove = (e) => {
    if (dragIndex === null) return;
    const mids = rowRefs.current.slice(0, rows.length).map((el) => {
      if (!el) return Infinity;
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    let to = mids.findIndex((m) => e.clientY < m);
    if (to === -1) to = rows.length - 1;
    if (to !== dragIndex) {
      setRows((prev) => moveItem(prev, dragIndex, to));
      setDragIndex(to);
    }
  };
  const onPointerUp = (e) => {
    if (dragIndex === null) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    draggingRef.current = false;
    setDragIndex(null);
    reorder(rows.map((p) => p.id));
  };

  return (
    <Page>
      <Header title="~/hobbies/next" sub={loading ? "loading…" : `${canonical.length} queued · drag to reorder`} />
      {rows.map((p, index) => (
        <div key={p.id} ref={(el) => (rowRefs.current[index] = el)} style={{ position: "relative", zIndex: dragIndex === index ? 1 : 0 }}>
          <PursuitRow
            pursuit={p}
            onOpen={openPursuit}
            highlight={dragIndex === index}
            extraMeta={<span style={{ fontSize: "10.5px", color: COLORS.dim }}>#{index + 1}</span>}
            dragHandle={
              <span
                onPointerDown={(e) => onPointerDown(e, index)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                aria-label={`drag ${p.title}`}
                style={{ display: "flex", cursor: "grab", touchAction: "none", flexShrink: 0, padding: "4px", margin: "-4px", marginTop: "2px" }}
              >
                <GripVertical size={14} color={COLORS.dim} />
              </span>
            }
            actions={[{ icon: Play, label: `start ${p.title}`, onClick: () => setStatus(p.id, "active") }]}
          />
        </div>
      ))}
      {!loading && rows.length === 0 && <Empty>// queue is empty — + to add, or queue an idea</Empty>}
      <Fab onClick={() => newPursuit({ status: "queued" })} label="add to queue" />
    </Page>
  );
}
