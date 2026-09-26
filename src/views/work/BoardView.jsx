// All work tasks by status, with project/tag filters — see ARCHITECTURE.md §7
// ("Work tasks"). A status switch instead of side-by-side kanban columns,
// which don't fit a phone.
import { COLORS } from "../../theme/colors.js";
import { usePersistentState } from "../../hooks/usePersistentState.js";
import { Segmented } from "../../components/Segmented.jsx";
import { TagPickerChip } from "../../components/TagChip.jsx";
import { STATUSES } from "../../lib/worktasks/model.js";
import { filterTasks, sortTasks } from "../../lib/worktasks/select.js";
import { Page, Header, PickChip } from "../hours/ui.jsx";
import { WorkTaskRow } from "./WorkTaskRow.jsx";
import { Fab } from "./ui.jsx";

function ordered(tasks, status) {
  if (status === "done") return [...tasks].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  if (status === "dropped") return [...tasks].sort((a, b) => (b.statusChangedAt || 0) - (a.statusChangedAt || 0));
  return sortTasks(tasks);
}

export default function BoardView({ store }) {
  const { tasks, workProjects, tags, newTask } = store;
  const [status, setStatus] = usePersistentState("manifest.work.board.status", "todo");
  const [projectIds, setProjectIds] = usePersistentState("manifest.work.board.projects", []);
  const [tagIds, setTagIds] = usePersistentState("manifest.work.board.tags", []);
  const toggleIn = (setter, id) => setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const filtered = filterTasks(tasks, { projectIds, tagIds });
  const counts = Object.fromEntries(STATUSES.map((s) => [s, filtered.filter((t) => t.status === s).length]));
  const list = ordered(filtered.filter((t) => t.status === status), status);
  const projectChips = workProjects.filter((p) => !p.archived || projectIds.includes(p.id));

  return (
    <Page>
      <Header title="~/work/board" sub={`${list.length} ${status}`} />
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
        <Segmented value={status} onChange={setStatus} options={STATUSES.map((s) => ({ key: s, label: `${s} ${counts[s]}` }))} fontSize="10px" />
      </div>
      <div className="filter-scroll" style={{ display: "flex", gap: "6px", padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
        <PickChip label="inbox" color={COLORS.dim} active={projectIds.includes("inbox")} onClick={() => toggleIn(setProjectIds, "inbox")} />
        {projectChips.map((p) => (
          <PickChip key={p.id} label={p.name} color={p.color} active={projectIds.includes(p.id)} onClick={() => toggleIn(setProjectIds, p.id)} />
        ))}
      </div>
      {tags.length > 0 && (
        <div className="filter-scroll" style={{ display: "flex", gap: "6px", padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          {tags.map((tag) => (
            <TagPickerChip key={tag.id} tag={tag} active={tagIds.includes(tag.id)} onClick={() => toggleIn(setTagIds, tag.id)} />
          ))}
        </div>
      )}
      {list.map((t) => (
        <WorkTaskRow key={t.id} task={t} store={store} />
      ))}
      {list.length === 0 && <div style={{ padding: "40px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>// nothing {status}</div>}
      <Fab
        onClick={() => {
          const onlyProject = projectIds.length === 1 && projectIds[0] !== "inbox" ? projectIds[0] : null;
          newTask({ projectId: onlyProject, status: status === "done" || status === "dropped" ? "todo" : status });
        }}
        label="add work task"
      />
    </Page>
  );
}
