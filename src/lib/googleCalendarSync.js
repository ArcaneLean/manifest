import { putGCalEvents, deleteGCalEvents, clearGCalEvents, getGCalMeta, putGCalMeta, clearGCalMeta } from "./gcalRepo.js";

// Read-only sync against the signed-in user's primary Google Calendar — see
// ARCHITECTURE.md §7 ("Google Calendar integration"). Uses incremental sync
// (syncToken) once available so a background refresh only transfers what
// changed; falls back to a bounded full window on first sync or when a
// syncToken goes stale.
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const INITIAL_WINDOW_PAST_DAYS = 30;
const INITIAL_WINDOW_FUTURE_DAYS = 730; // matches Calendar view's own max list horizon

function normalizeEvent(raw) {
  const allDay = Boolean(raw.start?.date);
  return {
    id: raw.id,
    summary: raw.summary || "(no title)",
    start: raw.start?.date || raw.start?.dateTime,
    end: raw.end?.date || raw.end?.dateTime,
    allDay,
    htmlLink: raw.htmlLink,
  };
}

async function fetchPage(accessToken, params) {
  const url = new URL(EVENTS_URL);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const err = new Error(`Google Calendar API error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function runSync(accessToken, syncToken) {
  const upserts = [];
  const deletedIds = [];
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
    const page = await fetchPage(accessToken, params);
    for (const raw of page.items || []) {
      if (raw.status === "cancelled") deletedIds.push(raw.id);
      else upserts.push(normalizeEvent(raw));
    }
    pageToken = page.nextPageToken;
    if (page.nextSyncToken) nextSyncToken = page.nextSyncToken;
  } while (pageToken);

  await putGCalEvents(upserts);
  await deleteGCalEvents(deletedIds);
  return nextSyncToken;
}

export async function syncGoogleCalendar(accessToken) {
  const meta = await getGCalMeta();
  try {
    const nextSyncToken = await runSync(accessToken, meta.syncToken);
    await putGCalMeta({ syncToken: nextSyncToken || meta.syncToken, lastSyncedAt: Date.now() });
  } catch (err) {
    // Expired/invalid syncToken — Google's documented signal to drop the
    // cache and do a fresh full sync rather than incremental.
    if (err.status === 410) {
      await clearGCalEvents();
      await clearGCalMeta();
      const nextSyncToken = await runSync(accessToken, null);
      await putGCalMeta({ syncToken: nextSyncToken, lastSyncedAt: Date.now() });
      return;
    }
    throw err;
  }
}
