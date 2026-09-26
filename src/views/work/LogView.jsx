// Done work by week and project, for standups and weekly reviews — see
// ARCHITECTURE.md §7 ("Work tasks").
import { COLORS } from "../../theme/colors.js";
import { weekLabel, dayLabel } from "../../lib/hours2/week.js";
import { toISO } from "../../lib/dateUtils.js";
import { logByWeek } from "../../lib/worktasks/log.js";
import { Page, Header, Section, fmt, Dot } from "../hours/ui.jsx";

export default function LogView({ store }) {
  const { tasks, workProjects, actual, openTask } = store;
  const weeks = logByWeek(tasks);

  return (
    <Page>
      <Header title="~/work/log" sub={`${weeks.reduce((n, w) => n + w.count, 0)} done`} />
      {weeks.length === 0 && <div style={{ padding: "40px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>// nothing done yet</div>}
      {weeks.map((w) => {
        const weekActual = w.groups.reduce((sum, g) => sum + g.tasks.reduce((s, t) => s + (actual[t.id] || 0), 0), 0);
        return (
          <Section key={w.weekStart} label={weekLabel(w.weekStart)} right={<span style={{ fontSize: "11px", color: COLORS.dim }}>{w.count} done{weekActual ? ` · ${fmt(weekActual)}` : ""}</span>}>
            {w.groups.map((g) => {
              const project = g.projectId && workProjects.find((p) => p.id === g.projectId);
              return (
                <div key={g.projectId || "inbox"} style={{ marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: project ? project.color : COLORS.dim, marginBottom: "4px" }}>
                    <Dot color={project ? project.color : COLORS.dim} size={6} />
                    {project ? project.name : "inbox"}
                  </div>
                  {g.tasks.map((t) => (
                    <div key={t.id} onClick={() => openTask(t)} style={{ display: "flex", gap: "8px", fontSize: "12.5px", padding: "3px 0 3px 12px", cursor: "pointer" }}>
                      <span style={{ color: COLORS.sage }}>[×]</span>
                      <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>{t.title}</span>
                      <span style={{ color: COLORS.dim, fontSize: "11px", whiteSpace: "nowrap" }}>
                        {actual[t.id] ? `${fmt(actual[t.id])} · ` : ""}
                        {dayLabel(toISO(new Date(t.completedAt)))}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </Section>
        );
      })}
    </Page>
  );
}
