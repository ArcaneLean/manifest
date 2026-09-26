# Personal Productivity PWA — Architecture

Status: pre-build reference doc, written after prototyping 8 views as standalone React artifacts.
Purpose: single source of truth to hand to Claude Code when scaffolding the real project.

## 1. Goals & constraints

- Android-first. Desktop (Fedora personal laptop, Windows work laptop) is a nice-to-have that
  falls out for free by being a PWA rather than a native app.
- Local-first for personal data: the personal apps must be fully usable offline. IndexedDB is
  the source of truth on-device, not a cache in front of a server.
- ~~Work data is the exception: work tasks and hours are online-only, stored server-side in a
  Cloudflare Worker + D1 so they're reachable from the work laptop and queryable/editable by
  Claude over MCP — see §6.~~ *Shelved — not doing this now (§6.2).* For now work data (Hours)
  stays local-first in IndexedDB like everything else.
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
| Hosting | GitHub Pages, auto-deployed from `main` by GitHub Actions | the move to a Cloudflare Worker (§6.2) is shelved — not doing it now |
| Work backend *(shelved — not now)* | ~~Cloudflare Worker (`/api/*` REST for the PWA, `/mcp` for Claude) + D1~~ | kept as a parked plan in §6.2; not being built now |
| Updates | Service worker | detects new deployed assets, prompts refresh — no separate release/versioning step needed |
| Sync/backup (personal) | Per-device JSON snapshot pushed to Google Drive's hidden `appDataFolder`, with manual whole-dataset restore | no backend/proxy needed (unlike a GitHub PAT, a Drive OAuth token is safe client-side); reuses the OAuth plumbing already built for Google Calendar |
| Conflict handling | N/A — deliberately not sync | personal data: each device only ever writes its own file, restore is a manual replace, never a merge. (The shelved Cloudflare plan would have kept work data as one server-side copy — §6.2) |

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
  date: string;                  // ISO, one entry per day
  segments: WorkSegment[];       // sequential, non-overlapping — see §7 "Hours: multi-project tracking"
}

interface WorkSegment {
  start: string;                  // "HH:MM"
  end: string | null;             // null while this segment is open (in progress)
  projectId: string | null;       // null = break
}

interface Project {
  id: string;
  name: string;
  color: string;              // hex, from the same curated 8-color palette as Tag
}
```

Hours has no per-week target store anymore — the running balance is derived at render
time from `worklog` directly: `sum((workedMinutes(entry) - normalDayMin))` over every
*completed* entry (last segment closed; a day that's started but not yet clocked out
doesn't count yet). `workedMinutes(entry)` sums only segments with a non-null
`projectId` — break time (`projectId: null`) falls out of the total automatically rather
than being tracked as a separate duration field. `normalDayMin` is a single persisted
setting (`normalDayHours`, default 8.5), not per-week data, so it lives in `localStorage`
via `usePersistentState` rather than IndexedDB — see §5.

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
| Task manager | Tasks, Templates, Recurring, Tags | bottom tab bar (4 tabs) | all lenses over the *same* task/template/tag store — not separate data, so they're bundled behind one app rather than separate launcher tiles. Matrix and Calendar *(archived)* — see below — were part of this set; Templates was later split into Templates (one-off) and Recurring — see §7 |
| Countdowns | Countdowns | none (single view) | yearly recurrence, `[042]`-style counter |
| Hours | Hours, Projects | 2-tab switch (log/projects) | clock in/out per project, worklog-derived running flex-time balance — see §7 "Hours: multi-project tracking" |
| Day Planner *(archived)* | Day Planner | none (single view) | day plan assembled from tasks/habits/day shapes, for today or any other day — see §7. Unwired from the launcher/`App.jsx` (unused in practice); code and IndexedDB stores (`dayshapes`, `dayoverrides`, `dayplans`) left in place rather than deleted, in case it's revisited |
| Habits | Habits | none (single view) | tracked habits, streak/frequency heatmap, quick-log + backfill |
| Shortlist | Shortlist | 3-tab switch (won't/could/want) | won't-do/could-do/want-to-do triage over the *same* task+habit records — see §7 "Shortlist" |
| Weather | Weather | none (single view) | cycling forecast cross-checked across independent models for the user's recurring ride windows — see §7 "Weather" |
| *(not built)* | — | — | settings — see §7 |

| View | Reads | Writes | Notes |
|---|---|---|---|
| Tasks | tasks, tags | tasks | list, sort by added/priority/tag, tag filter bar |
| Countdowns | countdowns | countdowns | yearly recurrence, `[042]`-style counter |
| Matrix *(archived)* | tasks | tasks | 2×2 lens over the *same* task store — not separate data |
| Calendar *(archived)* | tasks, templates, tags | tasks | list (infinite scroll, forward-only)/week/month toggle; also projected recurring templates' future occurrences (virtual, unpersisted) — see §7 |
| Templates | templates, tasks, tags | tasks (on run), templates | one-off, single-task presets only — split from the old combined Templates view, see §7 |
| Recurring | templates, tasks, tags | tasks (the recurring anchor lifecycle), templates | recurring templates only — split from the old combined Templates view, see §7 |
| Tags | tags | tags | CRUD, 8-color curated palette |
| Hours | worklog, projects | worklog | clock in/out per project or break; balance vs. `normalDayHours` (localStorage) derived at render time |
| Projects | projects | projects | CRUD, 8-color curated palette (same `ColorPicker`/palette as Tags) |

All prototypes so far are standalone artifacts with duplicated seed data and duplicated
component logic (`Toggle`, `TagChip`, quadrant helpers, date helpers). Consolidating these into
shared modules is the first real task once this moves into Claude Code — not optional cleanup,
since several views already depend on the *same* underlying task records.

## 6. Data split: local-first personal apps, online-only work apps

### 6.1 Personal data (unchanged)

- IndexedDB is the only thing the personal apps (Task manager, Countdowns, Habits, Shortlist,
  Weather) read/write during normal use.
- Periodically (or on-demand), a full snapshot is pushed to Google Drive — one file per
  device, not one shared file, so this is **backup, not cross-device sync**: opening the app
  on a second device does not pull the first device's data. This was a deliberate choice over
  a shared-file/pull design, made specifically to avoid needing conflict resolution (merging
  the same record edited on two devices while offline). Restore (§7 "Drive backup") is a
  manual, whole-dataset replace from any device's file, never a merge, so it doesn't reopen
  that problem.
- The original GitHub-repo-via-serverless-proxy plan was superseded by Drive specifically
  because Drive tokens are safe to hold client-side, unlike a GitHub PAT.

### 6.2 Work data: online-only on Cloudflare (shelved — not doing this now)

> **Status: shelved.** Decided not to pursue any of this plan right now — no hosting move, no
> Worker/D1 backend, no MCP server, no Work tasks app. Hours stays local-first in IndexedDB
> (and in the Drive snapshot) and is being redesigned in place instead — see §7 "Hours 2.0".
> Everything below is kept only as a parked reference in case it's revisited; don't build from
> it without re-deciding.

**Why**: work tasks and hours need to be reachable from the work laptop and queryable/editable
by Claude (AI agents over MCP). Giving a second writer (an agent) access to local-first data
would force real cross-device sync with conflict resolution — exactly what §6.1 avoids. Making
*only* the work data online-only sidesteps that: a single server-side copy has nothing to
merge, and an agent's edits are visible on the next load. The work laptop is online whenever
it's in use, and clocking in/out only while online is acceptable.

**Scope**: Hours (`worklog`, `projects`, and the `normalDayHours` setting, which moves out of
`localStorage` so every device and Claude compute the same flex balance) plus a new, separate
**Work tasks** app. Personal tasks, recurring templates and Shortlist stay local and are not
reachable by agents.

**Work tasks is a fork, not a mode**: its requirements are expected to diverge from the
personal Task manager, so it gets its own app (`WorkTasksApp`) with its own views *copied* from
Tasks, not shared components growing `if (work)` branches. Only primitives stay shared
(`Checkbox`, `TagChip`, `Toggle`, `ColorPicker`, theme). It has its own tags, and starts without
templates/recurrence/Shortlist — add them only if the work use case asks for them.

**Architecture**:
- **One Worker, two front doors, one domain layer.** `/api/*` (REST, for the PWA) and `/mcp`
  (MCP server, via Cloudflare's `agents` SDK) both call the same shared functions — never raw
  row writes from the MCP side. Logic that today lives in React hooks (e.g. `useHours`'
  `clockIn`/`switchSegment`/`clockOut` segment-building) moves into pure shared modules imported
  by both the PWA and the Worker, so an agent's `clock_in` behaves exactly like the button.
- **Storage: D1** (SQLite). Agents need filtered queries ("work tasks due this week tagged
  X"), which SQL gives directly; D1 Time Travel (point-in-time restore, 30 days) is the safety
  net for bad agent edits and replaces Drive backup for this data. Tables: `projects`,
  `worklog`, `settings`, `work_tasks`, `work_tags`, plus an `audit_log` (who — `pwa` or
  `mcp` — changed what, before/after). KV (eventually consistent) and R2 (blobs) don't fit
  edited, queried records.
- **MCP tools are actions, not table CRUD**: Hours — `get_status`, `clock_in`,
  `switch_project`, `clock_out`, `get_balance`, `get_week_summary` (per project), `edit_day`;
  Work tasks — `list_tasks(filters)`, `create_task`, `update_task`, `complete_task`. Soft
  delete only for agents.
- **Auth**: the PWA is served from the same Worker (static assets), so **Cloudflare Access**
  (free for a single user) protects the PWA and `/api/*` on one origin with no CORS or token
  handling. `/mcp` uses OAuth via `workers-oauth-provider` with Google as the upstream
  identity (reusing the existing OAuth client), allow-listed to the owner's account — required
  for Claude.ai custom connectors; Claude Code could also use a bearer token.
- **PWA side**: online versions of `hoursRepo.js`/`projectsRepo.js` with the same function
  signatures, so `HoursView`/`ProjectsView` barely change; loading/error states (views
  currently assume instant local reads), rollback of optimistic updates on failure, and the
  Work/Hours launcher tiles disabled while offline. A one-time import moves existing
  `worklog`/`projects` from IndexedDB into D1, after which those stores are dropped from the
  Drive snapshot.

**Hosting + CI/CD**: GitHub Actions keeps auto-deploying on push to `main`: `npm ci` →
`npm run build` → `wrangler d1 migrations apply --remote` → `wrangler deploy` (Worker + built
PWA together), with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repo secrets. Per-PR
preview URLs (`wrangler versions upload`) share the production D1 binding, so previews would
write to real data — only enable them with a separate preview database. Starting on
`workers.dev`; a custom domain is optional.

**Origin move caveat**: IndexedDB, `localStorage` (including `deviceId` and view prefs) are
per-origin, so the app on the new domain starts with **empty personal data**. Drive's
`appDataFolder` is scoped to the OAuth client, not the origin, so the old backups stay visible
— hence restore (step 1 below) ships before the move. The new origin must also be added to the
Google OAuth client's authorized JavaScript origins (same client id), and the PWA reinstalled
on each device. View prefs in `localStorage` aren't in the snapshot and simply reset.

**Build order**:
1. **Restore** from Drive (any device's backup) or a local file, plus export to file —
   *implemented*, see §7 "Drive backup".
2. **Hosting move**: Worker serving the PWA, new `deploy.yml`, Cloudflare Access; restore
   personal data on each device from Drive/file.
3. **Hours online**: D1 schema + migrations, REST API, shared hours logic, online repos,
   `normalDayHours` server-side, one-time import of existing worklog/projects.
4. **MCP server** with the Hours tools, OAuth, audit log.
5. **Work tasks app** (forked from Tasks) + its API and MCP tools.

**Still to check**: employer policy on keeping work data in a personal Cloudflare account and
exposing it to Claude.

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
    alongside real tasks and virtual recurring occurrences — no checkbox/edit/delete, tapping
    opens the event on calendar.google.com. `datesForGCalEvent` expands one event into every local
    day it touches (all-day spans use Google's exclusive `end.date`; timed events use local day
    boundaries).
  - **Per-calendar color + show/hide**: since one account can sync several calendars, each event's
    left border/label is colored per its own `calendarId` rather than one flat color, and the
    label names the calendar itself (`calendarSummary`) instead of a generic "google calendar" —
    the point being to tell calendars apart, not just flag "this came from gcal". Colors and a
    `hidden` flag live in a new `calendarSettings` IndexedDB store (`DB_VERSION` 7,
    `src/lib/calendarSettingsRepo.js`), one row per calendar keyed by `calendarId` like `gcalMeta`.
    Unlike `gcalEvents`/`gcalMeta`, this is a user choice, not a rebuildable cache, so it's a plain
    `ensureStore` rather than recreated on a version bump. `syncGoogleCalendar` keeps it in sync
    with the account's calendar list: a newly-discovered calendar gets a default color cycling
    through `TAG_PALETTE` by discovery order and starts visible, an already-known one keeps its
    color/hidden choice but picks up a renamed summary, and a calendar that disappears from the
    account has its settings row dropped alongside its events/meta. `useCalendarSettings.js`
    exposes `colorFor`/`isHidden` lookups (falling back to a steel-blue default before a
    calendar's row exists) plus `setColor`/`setHidden`; `CalendarView.jsx` filters `gcal.events` by
    `isHidden` before building the per-day event map, so a hidden calendar's events don't appear
    anywhere (list/week/month rows or month-grid dots). `ManageCalendarsModal.jsx` (opened from a
    gear icon next to the connect button, shown once connected) lists every synced calendar with
    its color dot (tap to open a `ColorPicker` — the same `TAG_PALETTE` swatch picker `TagsView`
    uses for tags, factored out to `src/components/ColorPicker.jsx`) and an eye/eye-off toggle for
    `hidden`; there's no add/remove here since the calendar list itself is owned by Google.
  - **Setup required per deployment**: needs a Google Cloud OAuth client ID (not secret, but
    project-specific — see `.env.example`) with the dev and deployed origins authorized; wired
    into the GitHub Pages build via a `VITE_GOOGLE_CLIENT_ID` repo variable
    (`.github/workflows/deploy.yml`). The connect/disconnect button
    (`GoogleCalendarButton.jsx`) renders nothing until that's configured, so the feature is
    invisible rather than broken for anyone who hasn't set it up.
- **Weather (implemented)**: recurring per-ride forecast checks, entirely client-side (no backend,
  per §1). A `RideWindow` (`src/lib/rideWindowsRepo.js`, `rideWindows` IndexedDB store) models a
  whole commute *route*, not a single spot on it — label, an ordered `stops` array (each a geocoded
  `{label, lat, lon}`), and a weekly `days`/`startTime`/`endTime` window shared by every stop (same
  `{days}` shape as `Template.recurring`, see §4). Pre-route records stored one `{lat, lon,
  locationLabel}` directly on the window; `rideWindowsRepo.listRideWindows` migrates those on read,
  merging legacy records that share the exact same days/startTime/endTime into one multi-stop route
  (that recurrence match is what identifies "same commute, different waypoint" rather than a
  coincidence) and leaving already-migrated records alone. `src/lib/openMeteo.js` talks to
  Open-Meteo — free, keyless, CORS-enabled, and able to return several independently-run forecast
  models (`ecmwf_ifs025`, `gfs_seamless`, `icon_seamless`) from one request, which is what makes
  cross-checking sources possible without a server proxy (most providers need either an API key or
  a `User-Agent` header the browser won't let JS set — Google Calendar's read had the same shape of
  problem, see above). Raw hourly forecasts are cached per rounded lat/lon (`weatherCache` store,
  `src/lib/weatherCacheRepo.js`, two-decimal key — well under model grid spacing) with a 45-minute
  TTL (`useCyclingForecast.js`), so stops shared across (or repeated within) routes share one fetch
  and a stale cached forecast is served (flagged) if a refetch fails, e.g. offline.
  `src/lib/cyclingWeather.js` turns a route's weekly rule into this week's upcoming occurrences,
  slices each occurrence's hourly data per stop per model, and combines per-stop aggregates into one
  route-level reading per model (`combineStops` — coldest/wettest/gustiest stop wins, same "worst
  case" philosophy as across models, since a rider hits every stop) before classifying a verdict
  (good/caution/poor) from cycling-specific thresholds (rain, gust, cold) plus a separate
  `disagreement` flag when models diverge past a threshold — the actual point of checking multiple
  sources rather than one. Severity is driven by the worst model, not an average, so a cyclist
  glancing at just the summary still gets the same warning a model-by-model read would give. No
  geocoding cache — location search (`geocodeLocation`) is a one-off lookup when adding a stop in
  `RideWindowEditModal`, not a recurring call.
  - **Day switcher (implemented)**: `WeatherView` shows one day at a time instead of every window's
    full week stacked together — a chip strip (today .. `HORIZON_DAYS - 1` days out, exported from
    `cyclingWeather.js` so the UI can't drift out of range with the data it navigates) picks the
    selected date, with a small dot marking days that have at least one occurrence. Only future days
    are navigable (today included) since past occurrences aren't meaningful for a forecast. Windows
    whose forecast fetch failed outright (no cache to fall back on, so no occurrences at all) are
    listed separately below the day's cards rather than silently disappearing from every day.
  - **Wind favorability (implemented)**: `RideWindow.direction` (an optional 8-point compass bearing,
    `COMPASS_POINTS` in `cyclingWeather.js`, picked in `RideWindowEditModal`) records which way the
    rider actually travels. `openMeteo.js` additionally requests `wind_direction_10m`; `windRelation`
    compares that (circular-averaged across the window's hours and across models, via
    `circularMeanDeg`) against the heading to classify each occurrence as headwind/tailwind/crosswind.
    A sustained headwind (not gusts — gusts already drive the poor/caution thresholds above) adds its
    own caution/poor reason and is also surfaced as its own line on the occurrence card; tailwind and
    crosswind are informational only and never worsen the verdict. Windows with no `direction` set
    skip this entirely rather than showing a meaningless relation.
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
- **Hours: multi-project tracking (implemented)**: reworked from one clock-in/out
  session per day to a sequence of `WorkSegment`s per day, each tagged to a `Project` (or
  `projectId: null` for a break) — see §4. The day is a small state machine: **not
  started** -> clock in (explicit project-or-break picker, no default selection, so a
  quick clock-in can never silently land on the wrong project) -> **started** (current
  segment open) -> **switch** (closes the open segment, opens a new one on a different
  project/break — also how you log a break, there's no separate break field anymore) or
  **clock out** (closes the open segment, no new one follows) -> **done**. `isCompleteEntry`
  now means "last segment closed", not "single start+end pair set"; balance/worked-minutes
  math is otherwise unchanged, just computed from `entry.segments` (`src/lib/timeUtils.js`).
  The day-row/backfill edit panel (`HoursView.jsx`) became a small list editor of segment
  rows (project select + start/end + delete) instead of one start/end/break form — reuse
  over a drag/resize timeline, since editing a handful of rows in a personal tracker didn't
  justify that complexity. Hours gained a second view, Projects (`ProjectsView.jsx`,
  `useProjects.js`, `projectsRepo.js`), a straight copy of Tags' CRUD pattern; `NavBar.jsx`
  was generalized to take an `items` prop (was hardcoded to Task Manager's 4 tabs) so Hours
  could get its own 2-tab log/projects switch. Project deletion doesn't cascade, same
  as tags — a stale `projectId` left on a worklog segment just renders as `"?"`.
  - **Migration**: pre-this-change `WorkLogEntry` rows (`{date, start, end, breakMin}`)
    are rewritten to the segment shape inside `db.js`'s `upgrade()` transaction itself
    (`DB_VERSION` 10), not lazily on read — a lazy migration in `hoursRepo.js` was tried
    first and had a real race: `useHours` and `useProjects` both fetch on mount, and
    `useProjects`'s independent read could return before the migration's write (creating
    the fallback project) landed, showing `"?"` for one load. Running it inside the
    versionchange transaction means every entry is migrated, and the fallback project
    created, before `getDB()` resolves for *any* caller. Old entries recorded only a
    break *duration*, not when it happened, so the break is placed as a synthetic
    trailing segment — this keeps the visible start-end span and total worked minutes
    identical to the original entry, it just can't recover the break's real position in
    the day. Migrated segments are tagged onto a fixed-id `"general"` project
    (`legacy-general`) created on demand, rather than reattributed to whichever project
    happens to be first in the list.
- **Templates vs. routines/checklists (resolved — see "Day Planner" below)**: templates
  were simplified to single-task presets. The earlier "bundle of N tasks run together" concept
  became `DayShape`, built as part of the Day Planner app rather than a Templates variant, since
  its job is carving out a day's fixed time (commute/work/routine blocks), not producing tasks.
- **Day Planner (implemented, later archived)**: unwired from the launcher and `App.jsx`'s
  `APPS` map (unused in practice) — the code, `DayShape`/`dayoverrides`/`dayplans` stores, and
  the rest of this section are left as-is rather than deleted, in case it's revisited. A
  single-view app, `DayPlannerView.jsx`, answering "what should
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
  - **Manual reorder of planned habits/tasks**: `dayplans`' `habitIds`/`taskIds` arrays were
    already ordered (insertion order from `planHabit`/`planTask`) but that order went unused —
    habits scheduled in whatever order the global `habits` list happened to have them, tasks
    always by quadrant rank. Up/down chevrons on each timeline row (`ItemRow`/`OverflowRow` in
    `DayPlannerView.jsx`, same affordance as `DayShapeEditModal`'s block reorder) now swap
    adjacent entries via `useDayPlanItems.js`'s `moveHabit`/`moveTask`, and `buildDayPlan` reads
    that array position back out: habits schedule in `habitIds` order outright, while tasks sort
    by position within `taskOrder` first and quadrant rank only as a fallback/tiebreak — so an
    explicitly planned task's manual position overrides its quadrant, but a task that's only on
    the plan because it's due today (never explicitly planned, no entry in `taskOrder`) still
    falls back to quadrant-rank order, sorting after every manually-ordered one. The timeline
    also now shows each row's end time (not just start), so consecutive rows' shared boundary —
    and any gap between rows — reads without doing startMin+duration arithmetic.
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
- **Matrix and Calendar (archived)**: unwired from `NavBar.jsx`'s `NAV_ITEMS` and
  `TaskManagerApp.jsx`'s `VIEWS` map (unused in practice), same posture as Day Planner above —
  `MatrixView.jsx`/`CalendarView.jsx` and everything they depend on (Google Calendar sync, the
  `gcalEvents`/`gcalMeta`/`calendarSettings` stores, `src/lib/recurrence.js`'s
  `occurrencesInRange`) are left in place rather than deleted, in case either is revisited.
  `TaskManagerApp`'s active-tab state falls back to Tasks if a persisted tab key
  (`manifest.taskmanager.active`) no longer resolves to a wired view, so an existing install with
  "matrix" or "calendar" persisted doesn't hit a blank screen.
- **Templates split into Templates and Recurring**: the old combined Templates view mixed
  one-off, single-task presets with recurring templates (schedule builder, countdown badge,
  anchor-task lifecycle) in one list with a per-item "one-off vs. recurring" branch. Split into
  two views/nav tabs so each is a plain list of one kind of thing: `TemplatesView.jsx` (one-off
  only, keeps the "run" button and run log) and `RecurringView.jsx` (recurring only, keeps the
  schedule builder and countdown badge, no run button since an anchor task is already live).
  Both still read/write the same `templates`/`useTemplates` store — filtered client-side by
  `!!template.recurring` — so editing a template's recurring flag (`TemplateEditModal.jsx`,
  shared by both views) moves it between the two views rather than needing a migration. The
  shared row rendering (`TemplateRow.jsx`, with its countdown badge) was factored out since both
  views need it; each view keeps its own persisted filter/group-by-tag state
  (`manifest.templates.*` / `manifest.recurring.*`).
- **Work hours (reworked)**: single session per day only (no split days). No export needed
  (confirmed). Reworked from a per-week target/progress-bar model into a running flex-time
  **balance**: the primary UI is clock in (log a start time) / clock out (log an end time +
  break), and each completed day's `worked - normalDayMin` (default 8.5h/day, user-configurable)
  is folded into a balance shown at the top of the view — carried across weeks, not reset weekly.
  The week list below it is now secondary: browsing/backfill/correction of individual days via
  the existing full start/end/break edit panel, which still works on any day including today.
  `weektargets` (IndexedDB store) was dropped (`db.js` v8) since the balance is derived from
  `worklog` at render time rather than tracked against a separate per-week figure.
- **Navigation shell (resolved)**: 7 views was too many for a standard bottom nav (~5 max), and
  the earlier icon-only 7-wide bar (`NavBar.jsx`) was a stopgap, not a real IA decision. Resolved
  by restructuring as an ecosystem: a home/launcher screen (`LauncherView.jsx`) lists three apps
  — task manager, countdowns, hours — `App.jsx` switches between the launcher and the active
  app's shell (`src/apps/*.jsx`), and each app owns its own internal nav. Task manager keeps a
  bottom tab bar (`NavBar.jsx`, trimmed from 7 to 5 task-store views, then to today's 4 — Matrix
  and Calendar were later archived and Templates split into Templates/Recurring, see above);
  countdowns and hours are single-view apps with no sub-nav. Every app shell renders a fixed `TopBar.jsx` (back arrow
  + app name) so there's always a way back to the launcher independent of that app's own nav.
  Top-level active app persists via `usePersistentState` (`manifest.nav.app`); task manager's
  active tab persists separately (`manifest.taskmanager.active`).
- **Drive backup (implemented)**: per-device backup of the entire local dataset to Google
  Drive, entirely client-side (no backend, per §1) — resolves §6's sync design. Auth is a
  second, independent OAuth token client (`src/lib/driveAuth.js`, same GIS pattern as
  `googleAuth.js`) scoped to `drive.appdata` rather than `calendar.readonly` — deliberately
  separate from the Calendar token client so connecting/disconnecting one feature never
  touches the other's grant, even though both share the same `VITE_GOOGLE_CLIENT_ID` (a scope
  is requested per token client, not baked into the client id itself).
  - **Per-device, not shared**: a random id (`crypto.randomUUID()`, `src/lib/deviceId.js`,
    persisted in `localStorage` as device identity rather than app data) names each device's
    backup file (`manifest-backup-{deviceId}.json`). Backups are push-only; reading a file
    back only happens through a manual restore (below), which replaces rather than merges —
    so two devices never need to merge; see §6.1 for why that was chosen over a
    pull/shared-file design.
  - **Storage location**: Drive's `appDataFolder`, a hidden space scoped to the app itself —
    invisible in the user's normal Drive UI, no folder-picker needed, and not readable by other
    apps. `src/lib/driveBackup.js` finds-or-creates the device's file there (cached file id in
    `localStorage` so a routine backup is a single `PATCH` media upload, not a list-then-write
    round trip; falls back to searching by name, then creating, if the cached id 404s).
  - **Snapshot shape**: `src/lib/backupSnapshot.js` dumps every IndexedDB object store into one
    JSON blob (`{version, exportedAt, stores}`), reading `db.objectStoreNames` dynamically
    rather than a hardcoded list so a newly added store is included with no separate list to
    maintain.
  - **Trigger + cadence**: `src/hooks/useDriveBackup.js` pushes once immediately on connect
    (interactive, requesting consent) and silently every 15 minutes thereafter while the app is
    open and `connected` is true (persisted flag, same "reconnect silently on load" pattern as
    `useGoogleCalendar`) — no attempt to push on every write, which would be far more API calls
    than a personal backup needs.
  - **UI**: `DriveBackupButton.jsx` (mirrors `GoogleCalendarButton.jsx`'s icon-button styling),
    rendered in `LauncherView.jsx`'s header since there's no settings view yet (see below). A
    plain click connects (first time) or triggers an immediate backup (once connected); a
    right-click disconnects (revokes the OAuth grant, does not delete the Drive file or clear
    `lastBackupAt`) — same deliberately-harder-to-hit placement as Calendar's disconnect.
  - **Restore + export (implemented)**: `BackupsModal.jsx`, opened from an always-visible
    archive icon in the launcher header (shown even without `VITE_GOOGLE_CLIENT_ID`, since the
    file path doesn't need Google). Built primarily for the Cloudflare hosting move (§6.2, since
    shelved), where the new origin would start with empty IndexedDB and a fresh `deviceId`; still
    useful on its own for moving data between devices/browsers.
    - Sources: every device's Drive file (`listBackupFiles` in `driveBackup.js`, newest first,
      "this device" vs. `device <id prefix>`; the consent popup is shown if Drive isn't connected
      yet), or a local JSON file. Export writes the same snapshot to a downloaded file
      (`backupFile.js`), so moving data never depends on Google being configured.
    - Before replacing anything, a `ConfirmDialog` shows the source and per-store record counts
      (`summarizeSnapshot`). `restoreBackupSnapshot` (`backupSnapshot.js`) then clears and
      refills every restorable store inside **one readwrite transaction** — a bad record aborts
      the whole restore and leaves existing data untouched (explicitly aborted on the
      synchronous `put()` DataError path, which IndexedDB doesn't abort on its own). The page
      reloads afterwards since every hook holds its own in-memory copy.
    - Rebuildable caches (`gcalEvents`, `gcalMeta`, `weatherCache`) are never restored — they
      refill from source. Stores the snapshot lacks are left untouched. Snapshots newer than
      `SNAPSHOT_VERSION` or not shaped like a snapshot are rejected.
    - Device labels are still just the id prefix — there's no device naming.
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

- **Shortlist (implemented)**: a triage app over non-done tasks and all habits — three buckets,
  `wont` / `could` / `want`, with `could` as the default. Deliberately a pure overlay (like Matrix
  over tasks): one IndexedDB row (`shortlist` store, `src/lib/shortlistRepo.js`) holding three
  ordered arrays of compound ids (`"task:<id>"` / `"habit:<id>"`) — same ordered-id-array shape as
  `dayplans`' `habitIds`/`taskIds`, so manual drag-reorder within a bucket is just an array
  position. No task/habit fields are duplicated; only which bucket an item is in and its rank
  within it.
  - **Self-heal on load** (`useShortlist.js`): any in-scope item (non-done, already-started task,
    any habit) missing from all three arrays is appended to `could` — this is how newly created
    tasks/habits get "imported" with no manual step. Any id no longer backed by a live in-scope
    item (task completed/deleted/not-yet-started, habit deleted) is dropped from whichever array
    holds it. Completed and not-yet-started tasks drop out of scope entirely rather than staying
    visible in whatever bucket they were last triaged into — a task with a future `startDate`
    isn't actionable yet (`taskDates.js`'s `isScheduled`), so it's excluded the same way a done
    task is, and re-enters `could` via self-heal once its start date arrives (any prior triage
    position isn't remembered).
  - **Movement is stepwise, not a direct jump**: buckets sit on a fixed line, `wont ← could →
    want`. Each row shows only the button(s) pointing toward a bucket that exists — `could` shows
    both ✕ (→ `wont`) and ✓ (→ `want`); `wont` shows only ✓ (→ `could`); `want` shows only ✕ (→
    `could`). A move appends the item to the end of the destination bucket.
  - **Completing a task**: a task row (not a habit row — habits have no `done` state) shows a
    `Checkbox` that calls `completeItem(id)`, the shortlist's thin wrapper around `useTasks`'
    `toggleTask`. Marking it done takes it out of scope immediately, so the same self-heal effect
    above drops it from its bucket on the next render rather than a bespoke removal path.
  - **Tags**: each task row shows its `TagChip`s (habits carry none). A bar below the tab switcher
    lists every tag present among the active bucket's rows, each with the same ✕/✓ buttons as a
    row — `moveTag(tagId, fromBucket, toBucket)` is the bulk sibling of `moveItem`, stepping every
    item in `fromBucket` carrying that tag to `toBucket` together, in their existing relative
    order. Bucket moves (single item or whole tag) are always button-driven; drag stays reserved
    for reordering position within a bucket, never for crossing buckets.
  - **Reset**: sets every item back to `could`, behind a confirm dialog (`ConfirmDialog.jsx`) since
    it touches everything at once and can't be undone. Ordering after reset is `[...could,
    ...want, ...wont]` — items already in `could` keep their relative position, since most of them
    aren't moving.
  - **Drag reorder**: pointer-events based (not native HTML5 drag-and-drop, which doesn't fire
    reliably on touch/Android — see §1 "Android-first"), implemented directly in
    `ShortlistView.jsx`. A drag handle tracks `pointermove`, compares the pointer's Y position
    against each row's midpoint to find the hover index, and live-reorders local state; the final
    order is persisted to `shortlistRepo` on `pointerup`.
  - **Not a Task Manager tab**: unlike Matrix/Templates/Tags (all lenses over the task+template
    store only), Shortlist also covers habits, so it's its own top-level launcher app rather than
    a 5th Task Manager tab.

- **Hours 2.0 (design draft, rev 3 — not built)**: a ground-up redesign of Hours around
  *weeks* and *booking codes*, replacing the per-day `normalDayHours` flex balance. Still
  local-first (IndexedDB + Drive snapshot) now that §6.2 is shelved.
  - **Projects and booking codes**: a project has **one or more booking codes**, e.g.
    Blenddata → `internal`; HQPack → `billable`, `unbillable`; Moving Intelligence →
    `billable`, `unbillable`. The booking code is what's booked and what the bank is kept
    per. **Decided: log against booking codes**, not bare projects. The clock-in/switch
    picker shows `project · code` chips (a project with one code shows just the project), since
    whether work is billable is known while doing it, not something to reconstruct on Friday.
  - **Three different numbers, deliberately kept apart**:
    - **Paid** (what I'm entitled to get paid for):
      - *Office time* is `out − in − 30m`. In/out is the office **arrival and departure**,
        recorded separately from logging (arrive 08:00, first log 08:20 → paid from 08:00).
        The 30m lunch is deducted however long the actual break was, but only if I took the
        office lunch break. That's a **per-day toggle** (default on), because a short visit,
        e.g. a morning at the office and the afternoon at home, may not include lunch.
      - *Home time* is **only logged work segments**. Breaks and untracked gaps don't count.
        This is on purpose, as motivation to keep home breaks short.
      - A day has **at most one office visit**. Paid = office span − 30m + logged work outside
        that span (the 30m only when the lunch toggle is on). A pure home day has no visit,
        so paid = logged. A pure office day is the span. A **mixed day** (office in the
        morning, home in the afternoon) is the same
        formula with no extra mode or flag.
    - **Logged**: the sum of work segments, per booking code. It says *where* time went.
      On office days it's usually below paid, and that's fine.
    - **Booked**: what goes into the employer's system. **40h/week**, 8h per workday in 30m
      steps, per booking code. No weekends: they're never shown or counted.
  - **Earned per code** (the bridge between paid and booked): the week's **gap**
    (`paid − logged`, mostly unlogged office time; it can be negative, e.g. a fully logged
    office day where the lunch deduction brings paid below logged) is attributed to codes in
    one of **two modes**, chosen per week at booking time:
    - *Proportional*: `earned[code] = logged[code] + gap × logged[code] / logged_week`.
    - *Single code*: the whole gap goes to one selected code (e.g. Blenddata internal).
      `earned[code] = logged[code] (+ gap for the selected code)`.

    Either way `Σ earned = paid`. The booking screen shows **both results side by side**
    (earned, proposed booking and bank-after per code) so the choice is made while seeing
    its effect. The chosen mode is stored with the booking, and the last-used mode and code
    become the default for next week.
  - **Bank, per booking code**: `bank[code] = opening[code] + Σ over booked weeks
    (earned[code] − booked[code])`. The total bank is the sum over codes (= Σ paid − Σ
    booked). A week only affects the bank once its booking is **confirmed**. Before that it
    shows as a projection. No cap or reset. The **opening balance** is entered by hand per
    code, copied from the system used today, as of the first week tracked in Hours 2.0.
    Worklog from before that week is ignored for the bank.
  - **Booking flow**: the app proposes, I edit, then confirm, and only confirming banks it.
    - *Proposal*: target per code = `earned[code] + bank[code]`, i.e. try to book what was
      earned plus what's owed from earlier weeks. Scale to the week's bookable total, round to
      30m with largest remainder so it sums exactly, then pack into 8h per day, preferring days
      where that code was actually logged. Whatever doesn't fit (rounding, or a total that's
      over or under 40h) stays in that code's bank automatically.
    - *Edit*: a days × codes grid with ±30m steppers. Each day must total 8h (0 on a leave
      day), and the week must total the bookable hours. The resulting per-code bank change is
      shown live.
    - *Confirm*: stores the lines, the gap mode, and the `earned` snapshot the bank math
      used. If a day in
      a booked week is edited later, the week gets a "changed since booked" flag with an
      option to re-confirm, so the bank never silently shifts under a booking I've already
      entered at work.
  - **Leave** (left open on purpose: whether leave also has to be *booked* is unknown, and the
    design supports both): a day can be marked
    `leave`. Either way it's **bank-neutral**. Without a leave code, bookable drops by 8h and
    paid adds 0. With a leave code, the day is booked 8h to it and paid gets 8h. So this can be
    decided later without affecting the bank. For now leave just reduces bookable, and
    switching to a leave code later only changes the booking proposal.
  - **Drill-down flow** (replaces the current single log view):
    1. **Weeks** (app root): total bank on top (tap for the per-code breakdown), then one row
       per week, newest first: `wk 39 · 22–26 sep   bookable 40h · paid 41h30 · +1h30
       [booked]`. Unbooked past weeks are flagged. The current week also shows what's left to
       break even. A **today strip** keeps arrive/leave and clock in/switch/out one tap away.
    2. **Week**: the same stats (plus logged), then a per-code table (logged · earned ·
       booked · diff · bank after), then the 5 workdays: `mon 22  office 08:00–17:05  8h35`,
       `tue 23  home  7h45 logged`, `wed 24  office+home  …`, `fri 26  leave`. Also the entry
       point to the booking grid.
    3. **Day**: office in/out and paid, logged per code, the unlogged gap (paid − logged), and
       the segment list (the existing editor), plus live controls when it's today.
  - **Data model sketch**:
    ```ts
    interface Project { id; name; color }                // unchanged
    interface BookingCode {                              // new `bookingcodes` store
      id: string;
      projectId: string;
      name: string;             // "billable", "unbillable", "internal"
      code?: string;            // the employer system's actual code, for reference
      archived?: boolean;
    }
    interface WorkDay {                                  // evolves WorkLogEntry, `worklog` store
      date: string;
      officeIn?: string | null;  // "HH:MM", office arrival (not "leave", to avoid clashing
      officeOut?: string | null; //  with leave days)
      officeLunch?: boolean;     // deduct the 30m office lunch; default true when officeIn set
      dayOff?: "leave" | null;
      segments: { start: string; end: string | null; codeId: string | null }[]; // null = break
    }
    interface WeekBooking {                              // new `bookings` store, key weekStart
      weekStart: string;                                 // Monday ISO
      lines: { date: string; codeId: string; minutes: number }[]; // 30m multiples
      gapMode: { kind: "proportional" } | { kind: "single"; codeId: string };
      earned: Record<string, number>;                    // codeId -> minutes, at confirm time
      confirmedAt: number | null;                        // null = draft
    }
    // Settings: bookable/week (40h), office lunch length (30m), last-used gapMode,
    //           opening bank { weekStart, perCode: Record<codeId, minutes> }.
    ```
    Migration: each existing project gets one default booking code, and segments'
    `projectId` maps to that code. Old entries become home days (no office visit).
    `normalDayHours` and the per-day balance go away.
  - **Still open**:
    1. Leave: whether it also has to be booked. The design works either way (see above), so
       it stays open until that's known.

## 8. Suggested build order for Claude Code

1. Scaffold PWA shell: manifest, service worker, IndexedDB wrapper, shared theme tokens.
2. Pull shared data model + helpers (§4) into one module; migrate prototype view logic in,
   view by view, replacing local seed data with real IndexedDB reads.
3. Build the navigation shell (resolves the open item in §7) and decide view priority/order.
4. Wire cross-view relationships that are currently "lens over the same data" only in
   principle: Matrix and Calendar both need to read the *same* task records the Tasks view
   writes, not copies.
5. ~~GitHub sync: serverless proxy + conflict strategy~~ — superseded by Drive backup (§6.1)
   for personal data. (The online-only Cloudflare backend for work data, §6.2, is shelved.)
6. Settings + home view, once the rest is stable enough to know what belongs there.
