import { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { ColorPicker } from "./ColorPicker.jsx";

// Lets the user tell apart, and selectively hide, events from different
// calendars on the connected Google account — see ARCHITECTURE.md §7
// ("Google Calendar integration"). One row per calendar the account has
// ever synced (from calendarSettings, kept in sync by
// googleCalendarSync.js); there's no add/remove here since the calendar
// list itself is owned by Google, not this app.
export function ManageCalendarsModal({ settings, onSetColor, onSetHidden, onClose }) {
  const [editingColorFor, setEditingColorFor] = useState(null);

  const sorted = [...settings].sort((a, b) => (a.calendarSummary || "").localeCompare(b.calendarSummary || ""));

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 100,
      }}
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
          <span style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", textTransform: "uppercase" }}>
            manage calendars
          </span>
          <span onClick={onClose} style={{ cursor: "pointer" }}>
            <X size={16} color={COLORS.dim} />
          </span>
        </div>

        {sorted.length === 0 && (
          <div style={{ padding: "20px 0", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>
            // no calendars synced yet
          </div>
        )}

        {sorted.map((cal) => (
          <div key={cal.calendarId} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "10px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                onClick={() => setEditingColorFor((prev) => (prev === cal.calendarId ? null : cal.calendarId))}
                title="change color"
                style={{ width: "14px", height: "14px", borderRadius: "50%", background: cal.color, flexShrink: 0, cursor: "pointer" }}
              />
              <span style={{ fontSize: "13px", color: cal.hidden ? COLORS.dim : COLORS.text, flex: 1, minWidth: 0, wordBreak: "break-word" }}>
                {cal.calendarSummary}
              </span>
              <span
                onClick={() => onSetHidden(cal.calendarId, !cal.hidden)}
                title={cal.hidden ? "hidden — click to show" : "shown — click to hide"}
                style={{ cursor: "pointer", flexShrink: 0 }}
              >
                {cal.hidden ? <EyeOff size={15} color={COLORS.dim} /> : <Eye size={15} color={COLORS.amber} />}
              </span>
            </div>
            {editingColorFor === cal.calendarId && (
              <div style={{ marginTop: "10px", paddingLeft: "26px" }}>
                <ColorPicker value={cal.color} onChange={(color) => onSetColor(cal.calendarId, color)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
