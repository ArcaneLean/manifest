// Local-file counterpart to the Drive backup — see ARCHITECTURE.md §7
// ("Drive backup"). Same snapshot format as driveBackup.js, just saved to /
// read from a file the user picks, so moving data between origins or
// devices works without Google being configured at all.
import { buildBackupSnapshot } from "./backupSnapshot.js";

export async function downloadBackupFile() {
  const snapshot = await buildBackupSnapshot();
  const blob = new Blob([JSON.stringify(snapshot)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `manifest-backup-${new Date(snapshot.exportedAt).toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readBackupFile(file) {
  try {
    return JSON.parse(await file.text());
  } catch {
    throw new Error("file isn't valid JSON");
  }
}
