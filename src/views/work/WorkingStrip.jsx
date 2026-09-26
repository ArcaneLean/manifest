// What's running in Hours right now, at the top of Now — see ARCHITECTURE.md
// §7 ("Start working from a task").
import { Square } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { timeToMinutes } from "../../lib/timeUtils.js";
import { Section, fmt, Dot, secondaryBtnStyle } from "../hours/ui.jsx";
import { codeLabel, codeColor } from "../hours/codes.js";

export function WorkingStrip({ store }) {
  const { running, canClock, tasks, codes, hoursProjects, nowMin, stopWork, openTask } = store;
  if (!running)
    return (
      <Section label="working on">
        <div style={{ fontSize: "12px", color: COLORS.dim }}>
          {canClock ? "// not clocked in — ▶ a task to start" : "// weekend — hours isn't tracked, so ▶ is off"}
        </div>
      </Section>
    );
  if (!running.codeId)
    return (
      <Section label="working on">
        <div style={{ fontSize: "12px", color: COLORS.dim }}>// on a break since {running.start}</div>
      </Section>
    );

  const task = running.taskId && tasks.find((t) => t.id === running.taskId);
  const elapsed = Math.max(0, nowMin - timeToMinutes(running.start));
  return (
    <Section label="working on">
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            onClick={task ? () => openTask(task) : undefined}
            style={{ fontSize: "13.5px", color: task ? COLORS.text : COLORS.dim, cursor: task ? "pointer" : "default", wordBreak: "break-word" }}
          >
            <span style={{ color: COLORS.amber }}>▶</span> {task ? task.title : "no task"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: COLORS.dim, marginTop: "4px" }}>
            <Dot color={codeColor(running.codeId, codes, hoursProjects)} size={6} />
            {codeLabel(running.codeId, codes, hoursProjects)} · since {running.start} ·{" "}
            <span style={{ color: COLORS.amber, fontWeight: 600 }}>{fmt(elapsed)}</span>
          </div>
        </div>
        <button onClick={stopWork} style={{ ...secondaryBtnStyle, display: "flex", alignItems: "center", gap: "6px" }}>
          <Square size={11} color={COLORS.dim} /> stop
        </button>
      </div>
    </Section>
  );
}
