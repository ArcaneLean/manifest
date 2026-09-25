import { useRef, useState } from "react";
import { X, Download, Upload, RefreshCw } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { ConfirmDialog } from "./ConfirmDialog.jsx";
import { getValidDriveToken } from "../lib/driveAuth.js";
import { listBackupFiles, downloadBackupFile as downloadDriveBackup } from "../lib/driveBackup.js";
import { downloadBackupFile, readBackupFile } from "../lib/backupFile.js";
import { summarizeSnapshot, restoreBackupSnapshot } from "../lib/backupSnapshot.js";

// Export + restore for the local dataset — see ARCHITECTURE.md §7 ("Drive
// backup"). Restore is always manual and whole-dataset: pick a snapshot
// (any device's Drive file, or a local file), review its record counts,
// confirm, then the page reloads onto the restored data. Same bottom-sheet
// treatment as ManageCalendarsModal.
export function BackupsModal({ driveConfigured, driveConnected, onClose }) {
  const [driveFiles, setDriveFiles] = useState(null);
  const [busy, setBusy] = useState(null); // null | "drive" | "export" | "restore" | fileId
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null); // { snapshot, source, summary }
  const fileInputRef = useRef(null);

  const run = async (key, fn) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(null);
    }
  };

  const stage = async (snapshot, source) => {
    const summary = await summarizeSnapshot(snapshot);
    setPending({ snapshot, source, summary });
  };

  // Not connected yet → the consent popup is needed; this runs straight
  // from a click, so the browser allows it.
  const loadDriveFiles = () =>
    run("drive", async () => {
      const token = await getValidDriveToken({ interactive: !driveConnected });
      setDriveFiles(await listBackupFiles(token));
    });

  const pickDriveFile = (file) =>
    run(file.id, async () => {
      const token = await getValidDriveToken({ interactive: !driveConnected });
      const snapshot = await downloadDriveBackup(token, file.id);
      await stage(snapshot, `drive · ${deviceLabel(file)} · ${formatTime(file.modifiedAt)}`);
    });

  const pickLocalFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file after an error
    if (!file) return;
    run("file", async () => stage(await readBackupFile(file), `file · ${file.name}`));
  };

  const confirmRestore = () =>
    run("restore", async () => {
      await restoreBackupSnapshot(pending.snapshot);
      window.location.reload();
    });

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "420px",
          maxHeight: "70vh",
          overflowY: "auto",
          background: COLORS.panel,
          border: `1px solid ${COLORS.borderBright}`,
          borderBottom: "none",
          borderTopLeftRadius: "10px",
          borderTopRightRadius: "10px",
          padding: "18px 20px 22px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <span style={sectionLabel}>backups</span>
          <span onClick={onClose} style={{ cursor: "pointer" }}>
            <X size={16} color={COLORS.dim} />
          </span>
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
          <button onClick={() => run("export", downloadBackupFile)} disabled={!!busy} style={actionButton}>
            <Download size={13} color={COLORS.amber} /> export to file
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={!!busy} style={actionButton}>
            <Upload size={13} color={COLORS.amber} /> restore from file
          </button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={pickLocalFile} style={{ display: "none" }} />
        </div>

        {driveConfigured && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={sectionLabel}>restore from drive</span>
              <span onClick={busy ? undefined : loadDriveFiles} title="list drive backups" style={{ cursor: busy ? "default" : "pointer" }}>
                <RefreshCw size={13} color={COLORS.dim} className={busy === "drive" ? "spin" : undefined} />
              </span>
            </div>
            {driveFiles === null && busy !== "drive" && (
              <div onClick={loadDriveFiles} style={{ ...hint, cursor: "pointer", color: COLORS.amber }}>
                $ list backups from every device
              </div>
            )}
            {driveFiles?.length === 0 && <div style={hint}>// no backups on drive yet</div>}
            {driveFiles?.map((file) => (
              <div
                key={file.id}
                onClick={busy ? undefined : () => pickDriveFile(file)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  padding: "10px 0",
                  cursor: busy ? "default" : "pointer",
                  fontSize: "13px",
                }}
              >
                <span style={{ flex: 1, minWidth: 0, color: COLORS.text }}>
                  {deviceLabel(file)}
                  <span style={{ color: COLORS.dim }}> · {formatTime(file.modifiedAt)}</span>
                </span>
                <span style={{ color: COLORS.dim, fontSize: "11.5px" }}>
                  {busy === file.id ? <RefreshCw size={12} color={COLORS.dim} className="spin" /> : formatSize(file.size)}
                </span>
              </div>
            ))}
          </>
        )}

        {error && <div style={{ ...hint, color: "#c47b8b", marginTop: "12px" }}>! {error}</div>}
      </div>

      {pending && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmDialog
            title="replace local data?"
            message={
              <>
                <div style={{ marginBottom: "8px" }}>{pending.source}</div>
                {pending.summary.map(({ store, count }) => (
                  <div key={store}>
                    {store}: {count}
                  </div>
                ))}
                <div style={{ marginTop: "8px" }}>
                  everything in these stores on this device is replaced — back up or export first if it has anything you want to keep.
                </div>
              </>
            }
            confirmLabel={busy === "restore" ? "restoring…" : "restore"}
            onConfirm={busy ? () => {} : confirmRestore}
            onCancel={() => setPending(null)}
          />
        </div>
      )}
    </div>
  );
}

function deviceLabel(file) {
  return file.isThisDevice ? "this device" : `device ${file.deviceId.slice(0, 8)}`;
}

function formatTime(ms) {
  return new Date(ms).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).toLowerCase();
}

function formatSize(bytes) {
  return bytes < 1024 ? `${bytes} b` : `${Math.round(bytes / 1024)} kb`;
}

const sectionLabel = { fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", textTransform: "uppercase" };

const hint = { fontSize: "12.5px", color: COLORS.dim, padding: "8px 0" };

const actionButton = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  background: "none",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: "12px",
  padding: "8px 10px",
  borderRadius: "6px",
  cursor: "pointer",
};
