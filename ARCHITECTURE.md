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
  startDate?: string | null; // ISO yyyy-mm-dd — task isn't active/shown by default before this
  dueDate?: string | null;   // ISO yyyy-mm-dd — should be done by this date, ideally before
  tags: string[];            // Tag ids
  templateId: string | null; // set when this is a recurring template's current "anchor"
                              // occurrence — see §7 "Recurring templates on the Calendar"
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
    | { type: "daily"; dateField?: DateField }
    | { type: "weekly"; days: number[]; dateField?: DateField }   // 0=Mon..6=Sun
    | { type: "monthly"; day: number; dateField?: DateField };    // day-of-month, clamped to month length
}

// Which field(s) an instantiated occurrence's date goes on. Absent (legacy
// templates saved before this setting existed) behaves as "due".
type DateField = "due" | "start" | "both";

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

## 5. Apps & views

The product is an **ecosystem of small apps behind a home/launcher screen**, not one flat pile
of views (see §7 "Navigation shell" for why). The launcher (`LauncherView.jsx`) lists the apps;
each app owns its own internal navigation and is otherwise independent.

| App | Views inside it | Sub-nav | Notes |
|---|---|---|---|
| Task manager | Tasks, Matrix, Calendar, Templates, Tags | bottom tab bar (5 tabs) | all 5 are lenses over the *same* task/template/tag store — not separate data, so they're bundled behind one app rather than five launcher tiles |
| Countdowns | Countdowns | none (single view) | yearly recurrence, `[042]`-style counter |
| Hours | Hours | none (single view) | worklog + per-week configurable target |
| Day Planner | Day Planner | none (single view) | day plan assembled from tasks/habits/day shapes, for today or any other day — see §7 |
| *(not built)* | — | — | settings — see §7 |

| View | Reads | Writes | Notes |
|---|---|---|---|
| Tasks | tasks, tags | tasks | list, sort by added/priority/tag, tag filter bar |
| Countdowns | countdowns | countdowns | yearly recurrence, `[042]`-style counter |
| Matrix | tasks | tasks | 2×2 lens over the *same* task store — not separate data |
| Calendar | tasks, templates, tags | tasks | list (infinite scroll, forward-only)/week/month toggle; also projects recurring templates' future occurrences (virtual, unpersisted) — see §7 |
| Templates | templates, tasks, tags | tasks (on run, and the recurring anchor lifecycle), templates | single-task presets, optional recurrence |
| Tags | tags | tags | CRUD, 8-color curated palette |
| Hours | worklog, weektargets | worklog, weektargets | per-week configurable target |

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
- **Calendar + unscheduled tasks**: tasks with neither a `startDate` nor a `dueDate` are
  invisible in the calendar view. Decide if that's intentional (calendar = dated tasks only,
  task list = everything) or if an "unscheduled" tray is needed.
- **Local/OS calendar integration (skipped)**: considered connecting the Calendar view to the
  device's native calendar (read-only, no-login, like TickTick's "Subscribe Calendar"). Not
  possible from a PWA — no browser exposes device calendar read access; that's a native-app-only
  API (Android `CalendarContract`, iOS EventKit). Would require moving off pure PWA (e.g.
  Capacitor + a calendar plugin), which conflicts with §1's PWA-only stance. If revisited without
  going native, `.ics` import/export is the lightweight fallback — not started.
- **Google Calendar integration (implemented)**: read-only sync of every calendar on the
  signed-in user's account (not just their primary calendar — enumerated via
  `users/me/calendarList`) into the Calendar view, entirely client-side (no backend, per §1) — auth
  via
  Google Identity Services' OAuth token client (`src/lib/googleAuth.js`, GIS script loaded in
  `index.html`), scoped to `calendar.readonly`. Two other approaches were considered and rejected:
  an "app password" (Google doesn't support one for the Calendar API — OAuth is required
  regardless), and the account's secret `.ics` URL (safer to leak — read-only and revocable
  independent of the whole Google account — but `calendar.google.com`'s ICS endpoint doesn't send
  CORS headers, so fetching it from a static PWA would need a small stateless proxy, which OAuth
  avoids).
  - **Token storage (deliberate)**: the OAuth access token is kept only in `googleAuth.js`'s
    module-level memory, never written to IndexedDB/localStorage — a leaked token is short-lived
    (~1h) and read-only rather than a durable secret sitting in storage. Only a boolean
    "previously connected" flag persists (`usePersistentState`, `manifest.gcal.connected`), which
    drives a **silent** (`prompt: ""`) token re-request on load rather than a popup; if that
    fails (expired Google session), the UI just falls back to the last-synced cache until the
    user reconnects.
  - **Show/hide vs. disconnect**: a plain click on the connect button (`GoogleCalendarButton.jsx`)
    once connected only flips a second persisted flag, `manifest.gcal.visible`
    (`usePersistentState`) — it hides or reveals the already-cached events with no network call,
    no re-auth, and no cache wipe. Actually disconnecting (`revokeGoogleAccess` plus dropping the
    `gcalEvents`/`gcalMeta` caches, which requires interactive re-auth to undo) is right-click
    only, so the destructive action isn't one accidental click away from the show/hide toggle.
  - **Cache + incremental sync**: `src/lib/googleCalendarSync.js` lists every calendar on the
    account (`users/me/calendarList`, skipping ones marked `deleted`) and syncs each one
    independently — Google issues `syncToken`s per calendar, not per account, so `gcalMeta`
    (`src/lib/gcalRepo.js`) holds one row per calendar (keyed by `calendarId`) rather than a
    single fixed row, and does a full resync of just that calendar if its token goes stale (API
    returns 410). One calendar failing (e.g. a stale grant on a single shared calendar) doesn't
    block the others; it only surfaces as an error if every calendar failed. First sync per
    calendar falls back to a bounded `[-30d, +730d]` window, matching the Calendar view's own
    list-mode horizon. Fetched events are normalized (`{key, id, calendarId, calendarSummary,
    summary, start, end, allDay, htmlLink}`) and cached in the `gcalEvents` IndexedDB store, keyed
    by `${calendarId}:${eventId}` since an event id is only unique within its own calendar
    (`DB_VERSION` 3 — the store is recreated rather than migrated on the version bump, since this
    is a rebuildable read-only cache, not user data; see `ensureStore` guard in `db.js` for why
    every other store creation is idempotent regardless). Calendars that disappear from the
    account (removed, unsubscribed, access revoked) have their cached events and meta dropped on
    the next sync.
  - **Rendering**: `CalendarView.jsx` renders gcal events as a third, read-only occurrence type
    alongside real tasks and virtual recurring occurrences — solid steel-blue left border
    (`GCAL_COLOR`, deliberately outside both the quadrant and `TAG_PALETTE` color families, same
    reasoning as §3's tag/priority split), no checkbox/edit/delete, tapping opens the event on
    calendar.google.com. `datesForGCalEvent` expands one event into every local day it touches
    (all-day spans use Google's exclusive `end.date`; timed events use local day boundaries).
  - **Setup required per deployment**: needs a Google Cloud OAuth client ID (not secret, but
    project-specific — see `.env.example`) with the dev and deployed origins authorized; wired
    into the GitHub Pages build via a `VITE_GOOGLE_CLIENT_ID` repo variable
    (`.github/workflows/deploy.yml`). The connect/disconnect button
    (`GoogleCalendarButton.jsx`) renders nothing until that's configured, so the feature is
    invisible rather than broken for anyone who hasn't set it up.
- **Recurring templates on the Calendar (implemented)**: a recurring template has exactly one
  open, real "anchor" `Task` at a time, linked via `Task.templateId`. It's instantiated when the
  template is created (or recurring is switched on), dated on the schedule's actual **first
  occurrence on or after today** (`firstOccurrenceOnOrAfter` in `src/lib/recurrence.js` —
  today itself if it already matches the rule, otherwise the next matching date; never just
  "today" regardless of the rule). It's then re-instantiated whenever the current anchor is
  resolved — either *completed*, or *deleted* (deletion is treated as "skip this occurrence",
  not "end the series" — see below) — stepped forward from the anchor's own planned date
  (`advanceOnce`), not from today's date, so resolving an occurrence early never skips ahead in
  the schedule. This sidesteps the "browsers can't run JS in the background" problem entirely —
  there's no scheduler to run, just a resolution-triggered handoff
  (`useTasks.spawnNextOccurrence`), called from both `toggleTask` and `removeTask` so it applies
  no matter which view (Tasks/Matrix/Calendar) completes or deletes it. `useTemplates`
  self-heals on every load: any recurring template missing an open anchor (a new template,
  `recurring` just switched on, or an anchor that somehow still ended up missing) gets one
  created on the schedule's first occurrence on/after today. The Calendar additionally projects
  further **virtual** occurrences beyond the anchor — computed on demand for whichever date
  range is on screen (`occurrencesInRange`), never persisted. Tapping a virtual occurrence opens
  `TemplateEditModal` (editing the series, not one occurrence) rather than a task; virtual
  occurrences have no checkbox and can't be completed, since they aren't real tasks yet.
  Distinguished visually from real occurrences with a dashed left border + a repeat icon
  (list/week rows) or a hollow vs. filled dot (month grid).
  - **Anchor date field**: `Template.recurring.dateField` ("due" | "start" | "both", default
    "due") controls whether an instantiated occurrence gets a `dueDate`, a `startDate`, or both
    (set to the same occurrence date — there's no due-offset between them; see the still-open
    item below). Chosen via a `Segmented` control in the template builder and
    `TemplateEditModal`. `recurrence.occurrenceDates(template, date)` is the shared helper both
    `useTemplates.ensureAnchor` and `useTasks.spawnNextOccurrence` use to turn an occurrence date
    into the `{startDate, dueDate}` pair actually stored on the task.
  - **Deleting the anchor = skip, not end series**: `useTasks.removeTask` treats deleting an
    open (`!done`) anchor task the same as completing it — it calls `spawnNextOccurrence` (keyed
    off the deleted task's own planned date) before removing it, so a new anchor takes its place
    immediately instead of the template silently losing its anchor (and disappearing from the
    Calendar's virtual-occurrence projection, which needs an anchor date to project from) until
    the next load's self-heal. Deleting a *completed* occurrence (history cleanup) does not
    re-spawn, since completing it already did.
  - **Note on `setState` updaters**: `toggleTask`, `removeTask`, and `updateTemplate` compute the
    updated/removed record from the hook's own state (not the `prev` passed into the
    `setTasks`/`setTemplates` updater) before calling
    `putTask`/`deleteTask`/`spawnNextOccurrence`/`ensureAnchor`. React may invoke an updater
    function more than once per call (e.g. Strict Mode in dev); `putTask`/`deleteTask` are
    idempotent either way, but `spawnNextOccurrence` mints a new task id, so running it twice
    would double up the next occurrence.
- **Templates vs. routines/checklists (resolved — see "Day Planner" below)**: templates
  were simplified to single-task presets. The earlier "bundle of N tasks run together" concept
  became `DayShape`, built as part of the Day Planner app rather than a Templates variant, since
  its job is carving out a day's fixed time (commute/work/routine blocks), not producing tasks.
- **Day Planner (implemented)**: a single-view app, `DayPlannerView.jsx`, answering "what should
  I do on a given day, and how much free time is left" from data the other apps already own — no
  new task/habit source of truth, just a composition layer (`src/lib/dayPlan.js`) plus three small
  new stores. It defaults to today but a prev/next day nav (plus a "today" jump) lets it plan any
  date, forward or back — useful for e.g. planning tomorrow's day the night before.
  - **DayShape**: `{ id, name, wakeMinutes, blocks: [{id, label, anchor, startMinutes?,
    durationMinutes}], weekdays }` (`dayshapes` store) — a named set of blocks (commute, work,
    routines), assignable to weekdays as a default (`weekdays`, 0=Mon..6=Sun, same convention as
    `Template.recurring.days`) with a one-tap per-date override (`dayoverrides` store, at most one
    row per date, only written when it differs from the weekday default). Managed from Day
    Planner's own `DayShapeEditModal.jsx` rather than a settings screen (still §7 "Settings view:
    doesn't exist yet"). `dayShapeForDate(dateISO, weekday)` (`useDayShapes.js`) already took an
    arbitrary date, not just today, so no change was needed there to support planning other days.
  - **Wake time as the day's anchor, chained vs. fixed blocks**: each block's `anchor` is either
    `"fixed"` (a specific clock time, `startMinutes`) or `"chained"` (starts right where the
    previous block in the list ends, or at the day's wake time if it's first) — `resolveBlocks`
    (`dayPlan.js`) walks the block list in array order to compute each one's actual start/end, so
    reordering blocks in `DayShapeEditModal` is a real control, not cosmetic. This lets a sequence
    like wake → morning routine → commute all shift together when wake time changes (so "when can
    I leave for work" and "when do I get home" fall out of the block chain instead of needing a
    dedicated field), while something like dinner or a bedtime routine can stay pinned to a fixed
    clock time regardless of how the day before it ran. Legacy blocks (no `anchor` field, only
    `startMinutes`) resolve as `"fixed"`, their original behavior — no migration needed. Wake time
    itself resolves date override → DayShape's own `wakeMinutes` → the `DAY_START_MIN` (06:30)
    fallback constant; there's still no per-day sleep-end setting, so `DAY_END_MIN` (23:00) stays
    a global constant, same posture as `WeekTarget` defaulting to 40h.
  - **Ad hoc extra blocks per date**: `dayoverrides` rows can also carry `wakeMinutes` (a one-off
    wake-time override) and `extraBlocks` (blocks that exist only for that one date — e.g. "airport
    commute" — never promoted into a DayShape template), managed from the Day Planner's "plan"
    button (`PlanDayModal.jsx`) alongside habit/task planning below, rather than from
    `DayShapeEditModal`, which only edits weekday templates.
  - **Planning is opt-in (changed)**: nothing shows up on a day's plan by default anymore. A new
    `dayplans` store (`{ date, habitIds, taskIds }`, via `useDayPlanItems.js`) holds an explicit
    per-date list of what's been planned; both habits and tasks require being added there before
    they're scheduled. This replaced the old "every positive habit with an estimate is on the plan
    every day" default (too noisy for the common case of *not* planning most habits daily) — a
    task's usual due/start-date-driven inclusion (`isTaskForDate`, unchanged) still applies
    independently, so a genuinely due task still shows without being explicitly planned, but
    planning a task for a day no longer requires (and never sets) a `startDate`/`dueDate` — the two
    are deliberately decoupled, since "work on this today" and "this is due today" are different
    facts about a task. An item that's explicitly planned gets an unplan (`×`) affordance in the
    timeline (`ItemRow`/`OverflowRow`'s `onUnplan`); a task that's *also* due keeps showing even
    after being unplanned, which is intentional (unplanning only removes the opt-in flag, not the
    due date), and its "planned + due" label makes that legible.
  - **`Task.estimatedMinutes?`/`Habit.estimatedMinutes?`**: optional; unset items simply don't
    enter the time budget.
  - **Fill algorithm** (`buildDayPlan`): resolved blocks (see above) carve fixed time out of the
    planning window; what's left ("discretionary" time) is greedily filled — planned habits first
    (quick, routine-anchored), then planned tasks by quadrant rank (`do` > `schedule` > `delegate`
    > `drop`) — and whatever doesn't fit is reported as `overflow` rather than silently dropped.
    Google Calendar events are merged into the rendered timeline for visibility only; they're never
    subtracted from the budget (they typically overlap a fixed work block already, and multi-day
    timed events are a known gap — only an event whose local start day matches is shown, the same
    boundary CalendarView's own multi-day handling draws).
  - **Overflow actions**: "squeeze in" is ephemeral, unpersisted UI state (a `Set` of
    `"task:<id>"`/`"habit:<id>"` keys, reset on reload) that forces an item onto the plan on top
    of the normal fill, overbooking the day rather than failing to place it — the budget number
    goes negative and the progress bar and free-time figure flip to the danger color. "Defer →
    next day" is a real mutation (`updateTask`, pushing `dueDate`/`startDate` to the day after
    whichever day is being viewed) and is task-only — deferring a habit's "due" state isn't a
    meaningful action since habits have no date field to push.
  - **Completion is today-only**: `toggleTask`/`logEntry` stamp the real current time, so marking
    something done only makes sense while viewing today — the checkbox is read-only (dimmed, no
    click handler) when browsing a different day, even though the rest of the plan (fixed blocks,
    scheduled items, overflow, squeeze/defer) stays fully interactive on any date.
- **Work hours**: single session per day only (no split days). No export needed (confirmed).
  Weekly target is configurable per-week, defaulting to 40h.
- **Navigation shell (resolved)**: 7 views was too many for a standard bottom nav (~5 max), and
  the earlier icon-only 7-wide bar (`NavBar.jsx`) was a stopgap, not a real IA decision. Resolved
  by restructuring as an ecosystem: a home/launcher screen (`LauncherView.jsx`) lists three apps
  — task manager, countdowns, hours — `App.jsx` switches between the launcher and the active
  app's shell (`src/apps/*.jsx`), and each app owns its own internal nav. Task manager keeps the
  5-tab bottom bar (`NavBar.jsx`, trimmed from 7 to the 5 task-store views); countdowns and hours
  are single-view apps with no sub-nav. Every app shell renders a fixed `TopBar.jsx` (back arrow
  + app name) so there's always a way back to the launcher independent of that app's own nav.
  Top-level active app persists via `usePersistentState` (`manifest.nav.app`); task manager's
  active tab persists separately (`manifest.taskmanager.active`).
- **Settings view**: doesn't exist yet. Needed for at least: default week hour target, GitHub
  sync configuration, theme (if made configurable at all).
- **Home/dashboard view (built)**: `LauncherView.jsx` is now the landing screen — an app
  launcher (task manager / countdowns / hours tiles), not a data dashboard. A richer dashboard
  (e.g. today's tasks + hours-this-week summary on the launcher itself) is a distinct,
  still-undesigned future step if wanted.
- **Start date / due date split (implemented)**: `Task.date` split into `startDate?` and
  `dueDate?` (§4). Tasks with a future `startDate` are hidden by default in Tasks and Matrix
  (they're not actionable yet), with a header icon toggle to reveal them —
  `src/components/ScheduledToggle.jsx` (hourglass/clock), sitting next to
  `CompletedToggle.jsx` (now a checkmark/circle) and shared via `useShowScheduled.js`, mirroring
  `useShowCompleted.js`. Calendar intentionally does NOT apply this filter — it shows a task on
  its `startDate` day and/or its `dueDate` day as two separate markers rather than a spanning
  bar (same-day tasks collapse into one "starts · due" marker); seeing what's scheduled on a
  given day is the point of a calendar. `SortSwitch` gained a "due" option (ascending, tasks
  without a `dueDate` sort last); there's deliberately no sort-by-start-date, since `startDate`
  is just the scheduled moment a task flips from inactive to active, not something worth
  ordering by.
  - **Still open**: due dates come in soft (self-imposed, "finish by Friday") and hard
    (external deadline) flavors — needs a way to mark which, e.g. `dueDateStrict: boolean`. Not
    designed further, not implemented.
  - **Resolved**: recurring templates generate a `startDate`, a `dueDate`, or both on the anchor
    task they instantiate, per `Template.recurring.dateField` (see "Recurring templates on the
    Calendar" above) — always the occurrence's own scheduled date on whichever field(s) are
    configured. **Still open**: an optional due-offset on the template (e.g. "+3 days") would
    cover cases like a weekly timesheet (instantiated Monday, due Friday) when `dateField` is
    "both".

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
