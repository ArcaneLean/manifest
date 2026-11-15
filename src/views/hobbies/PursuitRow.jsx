// One pursuit in any Hobbies list — see ARCHITECTURE.md §7 ("Hobbies").
// Middle opens the sheet; the optional right-hand actions move it between
// lists (▶ start, queue) without opening anything.
import { ListChecks, Link2 } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { itemTally, currentItem, isFinished } from "../../lib/hobbies/model.js";

export const STATUS_COLORS = {
  active: COLORS.amber,
  paused: COLORS.amberDim,
  queued: COLORS.dim,
  idea: COLORS.border,
  done: COLORS.sage,
  dropped: COLORS.border,
};

const meta = { display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10.5px", color: COLORS.dim, whiteSpace: "nowrap" };

export function PursuitRow({ pursuit, onOpen, actions = [], dragHandle = null, extraMeta = null, highlight = false }) {
  const finished = isFinished(pursuit);
  const dimmed = finished || pursuit.status === "paused";
  const tally = itemTally(pursuit.items);
  const current = !finished && currentItem(pursuit.items);

  return (
    <div
      className="task-row"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "13px 14px 13px 14px",
        borderBottom: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${STATUS_COLORS[pursuit.status] || COLORS.border}`,
        background: highlight ? COLORS.panel : undefined,
      }}
    >
      {dragHandle}
      <div onClick={() => onOpen(pursuit)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
        <div
          style={{
            fontSize: "14px",
            lineHeight: 1.45,
            color: dimmed ? COLORS.dim : COLORS.text,
            textDecorationLine: pursuit.status === "dropped" ? "line-through" : "none",
            textDecorationColor: COLORS.dim,
            wordBreak: "break-word",
          }}
        >
          {pursuit.title}
        </div>
        {pursuit.where && !finished && (
          <div style={{ fontSize: "12px", color: dimmed ? COLORS.dim : COLORS.sage, marginTop: "3px", wordBreak: "break-word" }}>@ {pursuit.where}</div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
          {pursuit.kind && <span style={{ ...meta, color: COLORS.amberDim }}>{pursuit.kind}</span>}
          {pursuit.status === "paused" && <span style={meta}>paused</span>}
          {pursuit.status === "dropped" && <span style={meta}>dropped</span>}
          {tally.total > 0 && (
            <span style={meta}>
              <ListChecks size={10} />
              {tally.done}/{tally.total}
            </span>
          )}
          {pursuit.link && (
            <span style={meta}>
              <Link2 size={10} />
            </span>
          )}
          {extraMeta}
        </div>
        {current && (
          <div style={{ fontSize: "11.5px", color: current.status === "doing" ? COLORS.amber : COLORS.dim, marginTop: "4px", wordBreak: "break-word" }}>
            {current.status === "doing" ? "▸ " : "next: "}
            {current.title}
          </div>
        )}
      </div>
      {actions.map(({ icon: Icon, label, onClick }) => (
        <button
          key={label}
          onClick={onClick}
          aria-label={label}
          title={label}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "30px",
            height: "30px",
            flexShrink: 0,
            background: "none",
            border: `1px solid ${COLORS.border}`,
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          <Icon size={13} color={COLORS.amber} />
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }) {
  return <div style={{ padding: "40px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>{children}</div>;
}
