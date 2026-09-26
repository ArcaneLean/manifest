// Hours 2.0 data migration (DB v12) — see ARCHITECTURE.md §7 ("Hours 2.0").
// Pure, so the exact same transform runs in db.js's upgrade() and on a v1
// backup snapshot being restored (backupSnapshot.js) — otherwise restoring an
// old backup would write `projectId` segments into a v12 database.
//   - every project gets one booking code (deterministic id, so both paths
//     produce the same ids) named "default", unless it already has one
//   - segments' `projectId` -> `codeId`
//   - days get no office visit, i.e. they become home days
// Idempotent: already-migrated records pass through unchanged.

export function defaultCodeId(projectId) {
  return `code-${projectId}`;
}

export function migrateHoursRecords({ worklog = [], projects = [], bookingcodes = [] }) {
  const codes = [...bookingcodes];
  const hasCode = new Set(codes.map((c) => c.projectId));
  for (const p of projects) {
    if (hasCode.has(p.id)) continue;
    codes.push({ id: defaultCodeId(p.id), projectId: p.id, name: "default", code: "", archived: false });
    hasCode.add(p.id);
  }
  const migrated = worklog.map((entry) => {
    if (!entry.segments || !entry.segments.some((s) => "projectId" in s)) return entry;
    return {
      ...entry,
      segments: entry.segments.map(({ projectId, ...rest }) =>
        "codeId" in rest ? rest : { ...rest, codeId: projectId ? defaultCodeId(projectId) : null }
      ),
    };
  });
  return { worklog: migrated, bookingcodes: codes };
}
