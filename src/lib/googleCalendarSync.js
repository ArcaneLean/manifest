import {
  putGCalEvents,
  deleteGCalEvents,
  deleteGCalEventsForCalendar,
  listGCalMeta,
  getGCalMeta,
  putGCalMeta,
  deleteGCalMeta,
} from "./gcalRepo.js";

// Read-only sync against every calendar on the signed-in account — see
// ARCHITECTURE.md §7 ("Google Calendar integration"). Uses incremental sync
// (syncToken), tracked separately per calendar since Google issues
// syncTokens per calendar rather than per account, so a background refresh
// only transfers what changed; falls back to a bounded full window on a
// calendar's first sync or when its syncToken goes stale.
const CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
const INITIAL_WINDOW_PAST_DAYS = 30;
const INITIAL_WINDOW_FUTURE_DAYS = 730; // matches Calendar view's own max list horizon

function eventsUrl(calendarId) {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
}

function normalizeEvent(raw, calendar) {
  const allDay = Boolean(raw.start?.date);
  return {
    key: `${calendar.id}:${raw.id}`,
    id: raw.id,
    calendarId: calendar.id,
    calendarSummary: calendar.summary,
    summary: raw.summary || "(no title)",
    start: raw.start?.date || raw.start?.dateTime,
    end: raw.end?.date || raw.end?.dateTime,
    allDay,
    htmlLink: raw.htmlLink,
  };
}

async function fetchJson(url, accessToken, params) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  const res = await fetch(u, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const err = new Error(`Google Calendar API error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function fetchAllCalendars(accessToken) {
  const calendars = [];
  let pageToken;
  do {
    const page = await fetchJson(CALENDAR_LIST_URL, accessToken, { pageToken, maxResults: 250 });
    for (const cal of page.items || []) {
      if (!cal.deleted) calendars.push({ id: cal.id, summary: cal.summaryOverride || cal.summary });
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return calendars;
}

async function runSync(accessToken, calendar, syncToken) {
  const upserts = [];
  const deletedKeys = [];
  let pageToken;
  let nextSyncToken;

  do {
    const params = syncToken
      ? { syncToken, pageToken, maxResults: 250, singleEvents: "true", showDeleted: "true" }
      : {
          timeMin: new Date(Date.now() - INITIAL_WINDOW_PAST_DAYS * 86400000).toISOString(),
          timeMax: new Date(Date.now() + INITIAL_WINDOW_FUTURE_DAYS * 86400000).toISOString(),
          pageToken,
          maxResults: 250,
          singleEvents: "true",
          showDeleted: "true",
        };
    const page = await fetchJson(eventsUrl(calendar.id), accessToken, params);
    for (const raw of page.items || []) {
      if (raw.status === "cancelled") deletedKeys.push(`${calendar.id}:${raw.id}`);
      else upserts.push(normalizeEvent(raw, calendar));
    }
    pageToken = page.nextPageToken;
    if (page.nextSyncToken) nextSyncToken = page.nextSyncToken;
  } while (pageToken);

  await putGCalEvents(upserts);
  await deleteGCalEvents(deletedKeys);
  return nextSyncToken;
}

async function syncOneCalendar(accessToken, calendar) {
  const meta = await getGCalMeta(calendar.id);
  try {
    const nextSyncToken = await runSync(accessToken, calendar, meta.syncToken);
    await putGCalMeta(calendar.id, { syncToken: nextSyncToken || meta.syncToken, lastSyncedAt: Date.now() });
  } catch (err) {
    // Expired/invalid syncToken — Google's documented signal to drop this
    // calendar's cache and do a fresh full sync rather than incremental.
    if (err.status === 410) {
      await deleteGCalEventsForCalendar(calendar.id);
      const nextSyncToken = await runSync(accessToken, calendar, null);
      await putGCalMeta(calendar.id, { syncToken: nextSyncToken, lastSyncedAt: Date.now() });
      return;
    }
    throw err;
  }
}

export async function syncGoogleCalendar(accessToken) {
  const calendars = await fetchAllCalendars(accessToken);
  const seenIds = new Set(calendars.map((c) => c.id));

  // Drop cached events/meta for calendars no longer on the account (removed,
  // unsubscribed from, or access revoked).
  for (const meta of await listGCalMeta()) {
    if (!seenIds.has(meta.calendarId)) {
      await deleteGCalEventsForCalendar(meta.calendarId);
      await deleteGCalMeta(meta.calendarId);
    }
  }

  // Each calendar syncs independently so one failing (e.g. a stale grant on
  // a single shared calendar) doesn't block the rest — but if every
  // calendar failed, surface that as a real error rather than silently
  // caching nothing.
  const errors = [];
  for (const calendar of calendars) {
    try {
      await syncOneCalendar(accessToken, calendar);
    } catch (err) {
      errors.push(err);
    }
  }
  if (calendars.length > 0 && errors.length === calendars.length) throw errors[0];
}
