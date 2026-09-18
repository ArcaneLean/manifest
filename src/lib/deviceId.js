// Stable per-device identifier — used to give each device its own backup
// blob on Drive rather than a single shared file (see ARCHITECTURE.md §7,
// "Drive backup"). Deliberately localStorage, not IndexedDB: it's device
// identity, not app data, and never needs to survive a "wipe my data"
// clear of IndexedDB.
const KEY = "manifest.deviceId";

export function getDeviceId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
