# Personal Productivity PWA — Architecture

Status: pre-build reference doc, written after prototyping 8 views as standalone React artifacts.
Purpose: single source of truth to hand to Claude Code when scaffolding the real project.

## 1. Goals & constraints

- Android-first. Desktop (Fedora personal laptop, Windows work laptop) is a nice-to-have that
  falls out for free by being a PWA rather than a native app.
- Local-first: the app must be fully usable offline. IndexedDB is the source of truth on-device,
  not a cache in front of a server.
- No dedicated backend server. GitHub acts as a sync/backup target, not a live database.
- FOSS/self-hosted orientation — avoid vendor lock-in where reasonable.
- No home-screen widgets: confirmed PWAs can't do this on Android or iOS today. A native
  companion widget is a separate, later decision if ever wanted — not part of this build.
- No local/OS calendar read access: there's no Web Calendar API (the W3C proposal was
  discontinued) — reading the device's native calendar (as TickTick does) requires a native
  shell (e.g. Capacitor + a calendar plugin), which is out of scope for a PWA. Skipped for now;
  see §7.

## 2. Stack decisions

| Layer | Choice | Why |
|---|---|---|
| UI | React, installable PWA | single codebase, works on Android + any desktop browser |
| Local storage | IndexedDB | source of truth, offline-first, survives reload |
| Hosting | GitHub Pages | free, static, fits FOSS orientation |
| Updates | Service worker | detects new deployed assets, prompts refresh — no separate release/versioning step needed |
| Sync/backup | GitHub repo (JSON snapshots), written via a small serverless proxy (e.g. Cloudflare Worker) | keeps the GitHub PAT off the client; GitHub itself is not fast/queryable enough to be the primary store |
| Conflict handling | Not yet designed | needs a real strategy before sync ships — see §6 |

## 3. Visual language ("Terminal Log" theme)

Established during prototyping, should be pulled into a shared theme/token file rather than
copy-pasted per component as it is now in the prototypes.

- Palette: near-black warm background `#0d0d0c`, amber phosphor accent `#ffb000`, sage
  `#7c9070` (completion/success), muted amber `#8a6a2a` (secondary priority), dim warm gray
  `#6b6459` (secondary text), all on IBM Plex Mono.
- Signature motifs, reused across views for consistency:
  - `[ ]` / `[×]` bracket checkboxes for tasks.
  - `[042]` zero-padded counter badges for "days until" (countdowns, recurring templates).
  - Colored left-edge stripe = priority quadrant color (tasks, templates).
  - Small pill chips (colored border + tinted background) = tags — deliberately a **separate
    color family** (steel blue, lavender, dusty rose, teal, ochre, periwinkle, terracotta,
    moss green) from the priority colors, so the two coding systems never visually collide.
  - `$ ran 'x' → +1 task · 14:02` style log lines for ephemeral confirmation feedback.

## 4. Data model

These are the shapes used across prototypes. Each prototype currently redefines them locally;
in the real build they belong in one shared module.

```ts
interface Task {
  id: string;
  text: string;
  done: boolean;
  urgent: boolean;
  important: boolean;      // urgent+important -> quadrant, see below
  date?: string;            // ISO yyyy-mm-dd, optional — ties into calendar view
  tags: string[];            // Tag ids
  createdAt: number;
  completedAt: number | null; // set when `done` flips true, cleared when un-done;
                               // drives the 30-day auto-purge of completed tasks
}

interface Tag {
  id: string;
  name: string;
  color: string;             // hex, from curated 8-color palette
}

interface Template {
  id: string;
  text: string;
  urgent: boolean;
  important: boolean;
  tags: string[];
  recurring: null
    | { type: "daily" }
    | { type: "weekly"; days: number[] }   // 0=Mon..6=Sun
    | { type: "monthly"; day: number };    // day-of-month, clamped to month length
  lastRun: string | null;    // ISO date, drives next-due calculation
}

interface Countdown {
  id: string;
  label: string;
  date: string;               // ISO original date (birthday, anniversary, etc.)
  // recurrence is implicitly yearly; next occurrence + "turns N" computed at render time
}

interface WorkLogEntry {
  date: string;                // ISO, one entry per day (single session — see §7 open items)
  start: string;                // "HH:MM"
  end: string;
  breakMin: number;
}

interface WeekTarget {
  weekStartISO: string;        // Monday of that week
  targetHours: number;         // default 40 if absent
}
```

Quadrant derivation (shared helper, currently duplicated in 3 files):

```ts
function quadrantFor(urgent: boolean, important: boolean) {
  if (urgent && important) return "do";        // amber
  if (!urgent && important) return "schedule";  // sage
  if (urgent && !important) return "delegate";  // muted amber
  return "drop";                                 // dim
}
```

## 5. Views

| View | Route (suggested) | Reads | Writes | Notes |
|---|---|---|---|---|
| Tasks | `/tasks` | tasks, tags | tasks | list, sort by added/priority/tag, tag filter bar |
| Countdowns | `/countdowns` | countdowns | countdowns | yearly recurrence, `[042]`-style counter |
| Matrix | `/matrix` | tasks | tasks | 2×2 lens over the *same* task store — not separate data |
| Calendar | `/calendar` | tasks | tasks | list (infinite scroll, forward-only)/week/month toggle |
| Templates | `/templates` | templates, tags | tasks (on run), templates | single-task presets, optional recurrence |
| Tags | `/tags` | tags | tags | CRUD, 8-color curated palette |
| Hours | `/hours` | worklog, weektargets | worklog, weektargets | per-week configurable target |
| *(not built)* | — | — | — | app shell/navigation, settings, home/dashboard |

All prototypes so far are standalone artifacts with duplicated seed data and duplicated
component logic (`Toggle`, `TagChip`, quadrant helpers, date helpers). Consolidating these into
shared modules is the first real task once this moves into Claude Code — not optional cleanup,
since several views already depend on the *same* underlying task records.

## 6. Sync design (recap, still needs implementation)

- IndexedDB is the only thing the app reads/writes during normal use.
- Periodically (or on-demand), a snapshot syncs to a GitHub repo through a small serverless
  proxy that holds the GitHub PAT server-side — the client never sees the token.
- **Not yet designed:** conflict resolution when the same record changes on two devices while
  offline. Needs a real strategy (last-write-wins with a timestamp is the simplest starting
  point; a proper CRDT/merge approach is more correct but more work) before this ships.

## 7. Open decisions carried over from prototyping

These came up in the process and were deliberately deferred — listed here so they aren't lost:

- **Shared schema**: tasks/templates/tags currently exist as separate copies per prototype
  file. Real build needs one module.
- **Tag deletion cascade**: undecided whether deleting a tag should cascade-remove it from
  tasks/templates, block deletion while in use, or something else.
- **Tag grouping simplification**: grouping-by-tag currently uses only a task's *first* tag.
  Multi-listing under every tag it has is more correct but adds real complexity (a task
  appearing twice needs careful handling for tap-to-toggle etc.).
- **Calendar + unscheduled tasks**: tasks with no `date` are invisible in the calendar view.
  Decide if that's intentional (calendar = dated tasks only, task list = everything) or if an
  "unscheduled" tray is needed.
- **Local/OS calendar integration (skipped)**: considered connecting the Calendar view to the
  device's native calendar (read-only, no-login, like TickTick's "Subscribe Calendar"). Not
  possible from a PWA — no browser exposes device calendar read access; that's a native-app-only
  API (Android `CalendarContract`, iOS EventKit). Would require moving off pure PWA (e.g.
  Capacitor + a calendar plugin), which conflicts with §1's PWA-only stance. If revisited without
  going native, `.ics` import/export is the lightweight fallback — not started.
- **Recurring template auto-instantiation**: browsers can't reliably run JS in the background
  while the PWA is closed. Realistic pattern is "check for overdue recurring templates on app
  open," not silent background creation — the UX copy/promise should match this.
- **Templates vs. routines/checklists**: templates were simplified to single-task presets.
  The earlier "bundle of N tasks run together" concept is a distinct, deferred feature —
  needs a name (routines? checklists? playbooks?) and its own view if built.
- **Work hours**: single session per day only (no split days). No export needed (confirmed).
  Weekly target is configurable per-week, defaulting to 40h.
- **Navigation shell**: 8 views is too many for a standard bottom nav (~5 max). Needs a real
  IA decision — overflow menu, drawer, or a curated bottom-5 + "more" — before this is usable
  as a cohesive app rather than a pile of separate screens.
- **Settings view**: doesn't exist yet. Needed for at least: default week hour target, GitHub
  sync configuration, theme (if made configurable at all).
- **Home/dashboard view**: mentioned early on as a possible landing view, never designed.
- **Start date / due date split (design decided, not yet implemented)**: `Task.date` will
  eventually split into `startDate?` (task can't be worked before this) and `dueDate?` (should
  be done by this, ideally before). Decisions made so far, to implement whenever this is picked
  up:
  - Due dates come in soft (self-imposed, "finish by Friday") and hard (external deadline)
    flavors — needs a way to mark which, e.g. `dueDateStrict: boolean`. Not designed further yet.
  - Tasks with a future `startDate` are hidden from the default task list (they're not
    actionable yet), with a header toggle to reveal them — same small icon-button pattern as
    `CompletedToggle` (`src/components/CompletedToggle.jsx`), sitting next to it.
  - Calendar view: a task with both dates renders as two separate day markers (on `startDate`
    and on `dueDate`), not a spanning bar across the days between. Simpler, and acceptable since
    the calendar is a reference view — the task list (via the active/inactive split above) is
    what actually drives "what's actionable now."
  - Sorting: due date is the only date-based sort worth adding (`SortSwitch`,
    `src/components/SortSwitch.jsx`). No sort-by-start-date — `startDate` is just the scheduled
    moment a task flips from inactive to active, not something worth ordering by.
  - Recurring templates generate `startDate` per instance; an optional due-offset on the
    template (e.g. "+3 days") would generate `dueDate` per instance for cases like a weekly
    timesheet (instantiated Monday, due Friday).

## 8. Suggested build order for Claude Code

1. Scaffold PWA shell: manifest, service worker, IndexedDB wrapper, shared theme tokens.
2. Pull shared data model + helpers (§4) into one module; migrate prototype view logic in,
   view by view, replacing local seed data with real IndexedDB reads.
3. Build the navigation shell (resolves the open item in §7) and decide view priority/order.
4. Wire cross-view relationships that are currently "lens over the same data" only in
   principle: Matrix and Calendar both need to read the *same* task records the Tasks view
   writes, not copies.
5. GitHub sync: serverless proxy + conflict strategy, once local-only usage feels solid.
6. Settings + home view, once the rest is stable enough to know what belongs there.
