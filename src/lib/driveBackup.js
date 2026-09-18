// Pushes a full local snapshot to this device's own hidden file in the
// user's Google Drive "appDataFolder" — see ARCHITECTURE.md §7 ("Drive
// backup"). Per-device backup, not cross-device sync: each device writes
// its own file (named by deviceId) and never reads another device's file,
// so there's no merge/conflict logic to get wrong. appDataFolder is a
// special Drive space, invisible in the user's regular Drive UI and only
// readable/writable by the app that created it — no folder-picker or
// visible clutter in the user's Drive.
import { getDeviceId } from "./deviceId.js";
import { buildBackupSnapshot } from "./backupSnapshot.js";

const FILES_URL = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const CACHED_FILE_ID_KEY = "manifest.drive.backupFileId";

function backupFilename() {
  return `manifest-backup-${getDeviceId()}.json`;
}

async function driveFetch(url, token, options) {
  const res = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, ...options?.headers } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Drive API ${res.status}: ${body || res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

// appDataFolder is scoped per-app already, so matching by filename alone
// (no need to also filter by parent) is enough to find this device's file.
async function findFileId(token, filename) {
  const q = encodeURIComponent(`name='${filename}' and trashed=false`);
  const res = await driveFetch(`${FILES_URL}?spaces=appDataFolder&q=${q}&fields=files(id)`, token, {});
  const { files } = await res.json();
  return files?.[0]?.id ?? null;
}

async function createFile(token, filename, jsonBody) {
  const boundary = "manifest-backup-boundary";
  const metadata = JSON.stringify({ name: filename, parents: ["appDataFolder"] });
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${jsonBody}\r\n` +
    `--${boundary}--`;
  const res = await driveFetch(`${UPLOAD_URL}?uploadType=multipart&fields=id`, token, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const { id } = await res.json();
  return id;
}

async function updateFile(token, fileId, jsonBody) {
  await driveFetch(`${UPLOAD_URL}/${fileId}?uploadType=media`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: jsonBody,
  });
}

// Builds a fresh snapshot and writes it to this device's backup file,
// creating it on first use. The file id is cached in localStorage so a
// routine backup is one PATCH call, not a list-then-write round trip; if
// the cached id turns out stale (file removed from Drive some other way),
// it falls back to searching by name once and re-creates if that also
// comes up empty.
export async function pushBackupSnapshot(token) {
  const filename = backupFilename();
  const body = JSON.stringify(await buildBackupSnapshot());

  let fileId = localStorage.getItem(CACHED_FILE_ID_KEY);
  if (fileId) {
    try {
      await updateFile(token, fileId, body);
      return;
    } catch (err) {
      if (err.status !== 404) throw err;
      fileId = null;
    }
  }

  fileId = await findFileId(token, filename);
  if (fileId) {
    await updateFile(token, fileId, body);
  } else {
    fileId = await createFile(token, filename, body);
  }
  localStorage.setItem(CACHED_FILE_ID_KEY, fileId);
}
