// Work tasks ↔ Hours — see ARCHITECTURE.md §7 ("Work tasks", "Start working
// from a task"). Actual time is derived from Hours segments carrying a
// `taskId`; nothing is stored on the task. Pure.
import { timeToMinutes } from "../timeUtils.js";
import { openSegment } from "../hours2/day.js";

// Minutes of one work segment; an open segment only counts (up to nowMin)
// on today. Breaks (no code) never count.
function segmentMinutes(seg, nowMin) {
  if (!seg.codeId) return 0;
  const start = timeToMinutes(seg.start);
  const end = seg.end ? timeToMinutes(seg.end) : nowMin;
  if (start === null || end === null || end === undefined) return 0;
  return Math.max(0, end - start);
}

// `worklog`: { [date]: WorkDay } → { [taskId]: minutes }
export function actualByTask(worklog, { todayISO, nowMin } = {}) {
  const out = {};
  for (const day of Object.values(worklog || {})) {
    const dayNow = day.date === todayISO ? nowMin : undefined;
    for (const seg of day.segments || []) {
      if (!seg.taskId) continue;
      const min = segmentMinutes(seg, dayNow);
      if (min > 0) out[seg.taskId] = (out[seg.taskId] || 0) + min;
    }
  }
  return out;
}

// { [projectId|"inbox"]: minutes } from actualByTask's result.
export function actualByProject(tasks, actual) {
  const out = {};
  for (const t of tasks) {
    const min = actual[t.id];
    if (!min) continue;
    const key = t.projectId || "inbox";
    out[key] = (out[key] || 0) + min;
  }
  return out;
}

// Today's open Hours segment ({start, codeId, taskId?}) or null.
export function runningSegment(worklog, todayISO) {
  return openSegment(worklog?.[todayISO]) || null;
}

// Which code ▶ clocks in on: the task's project link, if that code still
// exists and isn't archived. null → ask.
export function codeForTask(task, projects, codes) {
  const project = task.projectId && projects.find((p) => p.id === task.projectId);
  const code = project?.codeId && codes.find((c) => c.id === project.codeId);
  return code && !code.archived ? code.id : null;
}
