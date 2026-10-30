import { useEffect, useState } from "react";
import { X, Check, RefreshCw } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { ConfirmDialog } from "./ConfirmDialog.jsx";
import { CHANNEL, IS_PREVIEW, siteRoot } from "../lib/channel.js";
import { copyDataFrom, deleteOwnData } from "../lib/previewData.js";

// Switch between the real app and the PR previews deployed next to it — see
// ARCHITECTURE.md §7 ("PR previews"). The list is deploy.yml's
// versions.json at the site root. In a preview, also seeds or wipes that
// preview's own database (main's data is never written from here). Same
// bottom-sheet treatment as BackupsModal.
export function VersionsModal({ onClose }) {
  const [versions, setVersions] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // null | "copy" | "wipe"
  const [confirm, setConfirm] = useState(null); // null | "copy" | "wipe"

  useEffect(() => {
    fetch(new URL("versions.json", siteRoot()), { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`versions.json: ${res.status}`);
        return res.json();
      })
      .then((data) => setVersions(data.versions || []))
      .catch((err) => setError(err.message || String(err)));
  }, []);

  const open = (version) => {
    if (version.channel === CHANNEL) return onClose();
    window.location.href = new URL(version.path, siteRoot()).href;
  };

  const runConfirmed = async () => {
    const action = confirm;
    setBusy(action);
    setError(null);
    try {
      if (action === "copy") await copyDataFrom();
      else await deleteOwnData();
      window.location.reload();
    } catch (err) {
      setError(err.message || String(err));
      setBusy(null);
      setConfirm(null);
    }
  };

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={sectionLabel}>versions</span>
          <span onClick={onClose} style={{ cursor: "pointer" }}>
            <X size={16} color={COLORS.dim} />
          </span>
        </div>

        {versions === null && !error && (
          <div style={hint}>
            <RefreshCw size={12} color={COLORS.dim} className="spin" /> loading…
          </div>
        )}
        {versions?.map((v) => {
          const current = v.channel === CHANNEL;
          return (
            <div
              key={v.channel}
              onClick={() => open(v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                borderBottom: `1px solid ${COLORS.border}`,
                padding: "10px 0",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: current ? COLORS.amber : COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {v.channel === "main" ? "main" : `#${v.pr} ${v.title}`}
                </div>
                <div style={{ color: COLORS.dim, fontSize: "11.5px", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {v.channel === "main" ? "the real app" : v.branch}
                  {v.sha && ` · ${v.sha.slice(0, 7)}`}
                </div>
              </span>
              {current && <Check size={14} color={COLORS.amber} />}
            </div>
          );
        })}
        {versions?.length === 0 && <div style={hint}>// no versions listed</div>}

        {IS_PREVIEW && (
          <>
            <div style={{ ...sectionLabel, marginTop: "18px", marginBottom: "8px" }}>this preview's data</div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setConfirm("copy")} disabled={!!busy} style={actionButton}>
                copy from main
              </button>
              <button onClick={() => setConfirm("wipe")} disabled={!!busy} style={actionButton}>
                start empty
              </button>
            </div>
            <div style={{ ...hint, fontSize: "11.5px" }}>
              // previews keep their own data — nothing here touches the real app's. drive backup is off in previews.
            </div>
          </>
        )}

        {error && <div style={{ ...hint, color: "#c47b8b", marginTop: "12px" }}>! {error}</div>}
      </div>

      {confirm && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmDialog
            title={confirm === "copy" ? "copy main's data into this preview?" : "wipe this preview's data?"}
            message={
              confirm === "copy"
                ? "everything in this preview is replaced with a copy of the real app's data on this device. the real app is only read, never changed."
                : "this preview's database is deleted and starts empty. the real app's data is untouched."
            }
            confirmLabel={busy ? "working…" : confirm === "copy" ? "copy" : "wipe"}
            onConfirm={busy ? () => {} : runConfirmed}
            onCancel={() => setConfirm(null)}
          />
        </div>
      )}
    </div>
  );
}

const sectionLabel = { fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", textTransform: "uppercase" };

const hint = { display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: COLORS.dim, padding: "8px 0" };

const actionButton = {
  flex: 1,
  background: "none",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: "12px",
  padding: "8px 10px",
  borderRadius: "6px",
  cursor: "pointer",
};
