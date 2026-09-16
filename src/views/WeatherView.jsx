import { useState } from "react";
import { Plus, X, RefreshCw, MapPin } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { useClock } from "../hooks/useClock.js";
import { useRideWindows } from "../hooks/useRideWindows.js";
import { useCyclingForecast } from "../hooks/useCyclingForecast.js";
import { RideWindowEditModal } from "../components/RideWindowEditModal.jsx";
import { TOPBAR_HEIGHT } from "../components/TopBar.jsx";
import { describeRecurrence } from "../lib/recurrence.js";
import { MODELS } from "../lib/openMeteo.js";
import { daysBetween, startOfToday } from "../lib/dateUtils.js";

const VERDICT_STYLE = {
  good: { color: COLORS.sage, label: "good" },
  caution: { color: COLORS.amber, label: "caution" },
  poor: { color: COLORS.danger, label: "poor" },
  unknown: { color: COLORS.dim, label: "no data" },
};

function occurrenceDateLabel(date) {
  const diff = daysBetween(startOfToday(), date);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
}

function formatModel(agg) {
  if (!agg) return "—";
  return `${Math.round(agg.temp)}°  ${agg.precip.toFixed(1)}mm  ${Math.round(agg.wind)}/${Math.round(agg.gust)}km/h`;
}

function OccurrenceCard({ occurrence, startTime, endTime }) {
  const v = VERDICT_STYLE[occurrence.verdict.level];
  return (
    <div style={{ padding: "10px 0", borderTop: `1px solid ${COLORS.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
        <span style={{ fontSize: "12.5px", color: COLORS.text, fontWeight: 600, width: "84px", flexShrink: 0 }}>
          {occurrenceDateLabel(occurrence.date)}
        </span>
        <span
          style={{
            fontSize: "10px",
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            color: v.color,
            border: `1px solid ${v.color}`,
            borderRadius: "4px",
            padding: "1px 6px",
            flexShrink: 0,
          }}
        >
          {v.label}
        </span>
        <span style={{ fontSize: "10.5px", color: COLORS.dim }}>
          {occurrence.verdict.reasons.length > 0 ? occurrence.verdict.reasons.join(", ") : "no concerns"}
        </span>
      </div>
      <div style={{ paddingLeft: "0" }}>
        {MODELS.map(({ key, label }) => (
          <div key={key} style={{ display: "flex", gap: "8px", fontSize: "11px", color: COLORS.dim, marginTop: "2px" }}>
            <span style={{ width: "48px", flexShrink: 0, color: COLORS.dim }}>{label}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{formatModel(occurrence.aggregates[key])}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: "10px", color: COLORS.dim, marginTop: "4px" }}>
        {startTime}–{endTime} · temp/precip/wind·gust per source
      </div>
    </div>
  );
}

export default function WeatherView() {
  const now = useClock();
  const { rideWindows, loading, addRideWindow, updateRideWindow, removeRideWindow } = useRideWindows();
  const { forecastsByWindow, loading: forecastLoading, refresh } = useCyclingForecast(rideWindows);
  const [modalWindow, setModalWindow] = useState(undefined); // undefined = closed, null = new, object = editing

  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  const handleSave = (fields) => {
    if (modalWindow) updateRideWindow(modalWindow.id, fields);
    else addRideWindow(fields);
    setModalWindow(undefined);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 2px)",
        fontFamily: "'IBM Plex Mono', monospace",
        color: COLORS.text,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px", padding: `${TOPBAR_HEIGHT}px 0 100px 0` }}>
        <div style={{ padding: "28px 20px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", marginBottom: "6px" }}>
            {dateStr} · {timeStr}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: "20px", fontWeight: 600, color: COLORS.amber, letterSpacing: "0.5px" }}>~/weather</div>
            <button
              onClick={refresh}
              disabled={forecastLoading || rideWindows.length === 0}
              aria-label="refresh forecasts"
              style={{ background: "none", border: "none", cursor: rideWindows.length ? "pointer" : "default", padding: "4px" }}
            >
              <RefreshCw size={16} color={COLORS.dim} className={forecastLoading ? "spin" : undefined} />
            </button>
          </div>
          <div style={{ fontSize: "12px", color: COLORS.dim, marginTop: "4px" }}>
            {loading ? "loading…" : `${rideWindows.length} ride window${rideWindows.length === 1 ? "" : "s"} · ECMWF/GFS/ICON compared`}
          </div>
        </div>

        <div>
          {rideWindows.map((w) => {
            const fc = forecastsByWindow[w.id] || { occurrences: [], stale: false, error: null };
            return (
              <div key={w.id} style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div onClick={() => setModalWindow(w)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                    <div style={{ fontSize: "14.5px", color: COLORS.text, fontWeight: 600 }}>{w.label}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "3px", color: COLORS.dim, fontSize: "11.5px" }}>
                      <MapPin size={11} />
                      <span>{w.locationLabel}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: COLORS.dim, marginTop: "2px" }}>
                      {describeRecurrence({ type: "weekly", days: w.days })} · {w.startTime}–{w.endTime}
                    </div>
                  </div>
                  <span
                    onClick={() => removeRideWindow(w.id)}
                    aria-label="remove ride window"
                    style={{ cursor: "pointer", flexShrink: 0, paddingTop: "4px" }}
                  >
                    <X size={13} color={COLORS.dim} />
                  </span>
                </div>

                {fc.error && !fc.occurrences.length && (
                  <div style={{ fontSize: "11px", color: COLORS.danger, marginTop: "8px" }}>couldn't fetch forecast — check connection</div>
                )}
                {fc.stale && <div style={{ fontSize: "10px", color: COLORS.amberDim, marginTop: "8px" }}>showing cached forecast (offline)</div>}
                {fc.occurrences.length === 0 && !fc.error && (
                  <div style={{ fontSize: "11px", color: COLORS.dim, marginTop: "8px" }}>no upcoming occurrence in the next week</div>
                )}
                {fc.occurrences.map((occ) => (
                  <OccurrenceCard key={occ.iso} occurrence={occ} startTime={w.startTime} endTime={w.endTime} />
                ))}
              </div>
            );
          })}

          {!loading && rideWindows.length === 0 && (
            <div style={{ padding: "40px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>
              // no ride windows set up yet — add when/where you usually ride
            </div>
          )}
        </div>

        {modalWindow !== undefined && (
          <RideWindowEditModal
            rideWindow={modalWindow}
            onSave={handleSave}
            onClose={() => setModalWindow(undefined)}
          />
        )}

        <button
          className="fab"
          onClick={() => setModalWindow(null)}
          style={{
            position: "fixed",
            bottom: "28px",
            right: "calc(50% - 210px + 20px)",
            width: "52px",
            height: "52px",
            borderRadius: "8px",
            background: COLORS.amber,
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 20px rgba(255,176,0,0.35), 0 4px 12px rgba(0,0,0,0.5)",
            cursor: "pointer",
          }}
        >
          <Plus size={24} color={COLORS.bg} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
