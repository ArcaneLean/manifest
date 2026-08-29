// OAuth access via Google Identity Services (loaded in index.html) — see
// ARCHITECTURE.md §7 ("Google Calendar integration"). Deliberately scoped
// to calendar.readonly and deliberately NOT persisted anywhere: the access
// token lives only in this module's memory and is re-requested (silently,
// once the user has granted access once) on each app load. A leaked/stale
// token is short-lived (~1h) and read-only rather than a durable secret
// sitting in IndexedDB/localStorage.
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

let tokenClient = null;
let currentToken = null; // { accessToken, expiresAt }

export function isGoogleAuthConfigured() {
  return Boolean(CLIENT_ID);
}

function isGisLoaded() {
  return typeof window !== "undefined" && Boolean(window.google?.accounts?.oauth2);
}

// The GIS script tag loads async; callers should only reach here once the
// app has had a chance to mount, but this still fails clearly if it hasn't.
function ensureTokenClient() {
  if (!isGisLoaded()) throw new Error("Google Identity Services not loaded yet");
  if (!CLIENT_ID) throw new Error("VITE_GOOGLE_CLIENT_ID is not configured");
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: () => {}, // replaced per-call below
    });
  }
  return tokenClient;
}

// `interactive: false` asks GIS to reuse the device's existing Google
// session/consent silently (prompt: ""), failing rather than popping a
// picker — used for background refresh. `interactive: true` is only for
// an explicit "connect" click.
function requestAccessToken({ interactive }) {
  return new Promise((resolve, reject) => {
    let client;
    try {
      client = ensureTokenClient();
    } catch (err) {
      reject(err);
      return;
    }
    client.callback = (resp) => {
      if (resp.error) {
        reject(new Error(resp.error));
        return;
      }
      currentToken = { accessToken: resp.access_token, expiresAt: Date.now() + resp.expires_in * 1000 };
      resolve(currentToken.accessToken);
    };
    client.requestAccessToken({ prompt: interactive ? "consent" : "" });
  });
}

// Reuses the in-memory token until shortly before it expires, otherwise
// requests a fresh one.
export async function getValidAccessToken({ interactive = false } = {}) {
  if (currentToken && currentToken.expiresAt - 60_000 > Date.now()) return currentToken.accessToken;
  return requestAccessToken({ interactive });
}

export function revokeGoogleAccess() {
  const token = currentToken?.accessToken;
  currentToken = null;
  tokenClient = null;
  if (token && isGisLoaded()) {
    window.google.accounts.oauth2.revoke(token, () => {});
  }
}
