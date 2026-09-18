// OAuth access for the Drive per-device backup — see ARCHITECTURE.md §7
// ("Drive backup"). Structurally a copy of googleAuth.js (same GIS token
// client pattern, same in-memory-only token), but deliberately a *separate*
// token client scoped only to drive.appdata: sharing one client between
// Calendar and Backup would mean connecting either feature asks for both
// scopes, and disconnecting one would revoke the other's grant too.
const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

let tokenClient = null;
let currentToken = null; // { accessToken, expiresAt }

export function isDriveAuthConfigured() {
  return Boolean(CLIENT_ID);
}

function isGisLoaded() {
  return typeof window !== "undefined" && Boolean(window.google?.accounts?.oauth2);
}

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

// See googleAuth.js's requestAccessToken for the interactive/silent split.
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

export async function getValidDriveToken({ interactive = false } = {}) {
  if (currentToken && currentToken.expiresAt - 60_000 > Date.now()) return currentToken.accessToken;
  return requestAccessToken({ interactive });
}

export function revokeDriveAccess() {
  const token = currentToken?.accessToken;
  currentToken = null;
  tokenClient = null;
  if (token && isGisLoaded()) {
    window.google.accounts.oauth2.revoke(token, () => {});
  }
}
