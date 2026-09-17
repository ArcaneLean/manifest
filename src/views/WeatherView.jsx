import { useMemo, useState } from "react";
import { Plus, X, RefreshCw, MapPin } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { useClock } from "../hooks/useClock.js";
import { useRideWindows } from "../hooks/useRideWindows.js";
import { useCyclingForecast } from "../hooks/useCyclingForecast.js";
import { RideWindowEditModal } from "../components/RideWindowEditModal.jsx";
import { TOPBAR_HEIGHT } from "../components/TopBar.jsx";
import { describeRecurrence } from "../lib/recurrence.js";
import { MODELS } from "../lib/openMeteo.js";
import { HORIZON_DAYS, nearestCompassPoint } from "../lib/cyclingWeather.js";
import { daysBetween, startOfToday, addDays, toISO } from "../lib/dateUtils.js";

const VERDICT_STYLE = {
  good: { color: COLORS.sage, label: "good" },
  caution: { color: COLORS.amber, label: "caution" },
  poor: { color: COLORS.danger, label: "poor" },
  unknown: { color: COLORS.dim, label: "no data" },
};

const WIND_RELATION_STYLE = {
  headwind: { color: COLORS.danger },
  tailwind: { color: COLORS.sage },
  crosswind: { color: COLORS.dim },
};

// Short label for a day chip — "today"/"tmrw" read faster at a glance than
// a weekday name for the two days a cyclist actually plans around.
function chipDayLabel(date) {
  const diff = daysBetween(startOfToday(), date);
  if (diff === 0) return "today";
  if (diff === 1) return "tmrw";
  return date.toLocaleDateString("en-GB", { weekday: "short" }).toLowerCase();
}

function fullDayLabel(date) {
  const diff = daysBetween(startOfToday(), date);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short" }).toLowerCase();
}

function formatModel(agg) {
  if (!agg) return "—";
  return `${Math.round(agg.temp)}°  ${agg.precip.toFixed(1)}mm  ${Math.round(agg.wind)}/${Math.round(agg.gust)}km/h`;
}

function WindLine({ wind }) {
  if (!wind || !wind.relation) return null;
  const style = WIND_RELATION_STYLE[wind.relation];
  const point = nearestCompassPoint(wind.dirDeg);
  return (
    <div style={{ fontSize: "11px", color: style.color, marginTop: "4px" }}>
      {point?.arrow} {wind.relation} ~{Math.round(wind.speedKmh)}km/h from {point?.label}
    </div>
  );
}

// City-only stop names joined for a compact route line — "Vessem, Veldhoven,
// Eindhoven" rather than each stop's full geocoded label.
function routeStopsLabel(stops) {
  return stops.map((s) => (s.label || "").split(",")[0].trim()).join(", ");
}

function RideDayCard({ rideWindow, occurrence, stale, error, onEdit, onRemove }) {
  const v = VERDICT_STYLE[occurrence.verdict.level];
  return (
    <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <div onClick={onEdit} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14.5px", color: COLORS.text, fontWeight: 600 }}>{rideWindow.label}</span>
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
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "3px", color: COLORS.dim, fontSize: "11.5px" }}>
            <MapPin size={11} />
            <span>{routeStopsLabel(rideWindow.stops)}</span>
            <span>· {rideWindow.startTime}–{rideWindow.endTime}</span>
          </div>
        </div>
        <span onClick={onRemove} aria-label="remove route" style={{ cursor: "pointer", flexShrink: 0, paddingTop: "4px" }}>
          <X size={13} color={COLORS.dim} />
        </span>
      </div>

      <div style={{ fontSize: "10.5px", color: COLORS.dim, marginTop: "8px" }}>
        {occurrence.verdict.reasons.length > 0 ? occurrence.verdict.reasons.join(", ") : "no concerns"}
      </div>

      <WindLine wind={occurrence.wind} />

      <div style={{ marginTop: "6px" }}>
        {MODELS.map(({ key, label }) => (
          <div key={key} style={{ display: "flex", gap: "8px", fontSize: "11px", color: COLORS.dim, marginTop: "2px" }}>
            <span style={{ width: "48px", flexShrink: 0, color: COLORS.dim }}>{label}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{formatModel(occurrence.aggregates[key])}</span>
          </div>
        ))}
      </div>

      {error && !stale && (
        <div style={{ fontSize: "11px", color: COLORS.danger, marginTop: "8px" }}>couldn't fetch forecast — check connection</div>
      )}
      {stale && <div style={{ fontSize: "10px", color: COLORS.amberDim, marginTop: "8px" }}>showing cached forecast (offline)</div>}
    </div>
  );
}

export default function WeatherView() {
  const now = useClock();
  const { rideWindows, loading, addRideWindow, updateRideWindow, removeRideWindow } = useRideWindows();
  const { forecastsByWindow, loading: forecastLoading, refresh } = useCyclingForecast(rideWindows);
  const [modalWindow, setModalWindow] = useState(undefined); // undefined = closed, null = new, object = editing
  const [dayOffset, setDayOffset] = useState(0);

  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  const days = useMemo(() => {
    const today = startOfToday();
    return Array.from({ length: HORIZON_DAYS }, (_, i) => {
      const date = addDays(today, i);
      return { offset: i, date, iso: toISO(date) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr]);

  const isoWithRides = useMemo(() => {
    const set = new Set();
    for (const w of rideWindows) {
      for (const occ of forecastsByWindow[w.id]?.occurrences || []) set.add(occ.iso);
    }
    return set;
  }, [rideWindows, forecastsByWindow]);

  const selectedDay = days[dayOffset] || days[0];

  const windowsForDay = rideWindows
    .map((w) => {
      const fc = forecastsByWindow[w.id];
      const occurrence = fc?.occurrences.find((o) => o.iso === selectedDay.iso);
      return occurrence ? { rideWindow: w, occurrence, stale: fc.stale, error: fc.error } : null;
    })
    .filter(Boolean);

  // Windows whose forecast fetch failed outright (no cache to fall back on)
  // have no occurrences to slot into any day — surfaced separately so they
  // don't just silently vanish from the view.
  const windowsWithNoData = rideWindows.filter((w) => {
    const fc = forecastsByWindow[w.id];
    return fc?.error && (fc.occurrences?.length ?? 0) === 0;
  });

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
            {loading ? "loading…" : `${rideWindows.length} route${rideWindows.length === 1 ? "" : "s"} · ECMWF/GFS/ICON compared`}
          </div>
        </div>

        {rideWindows.length > 0 && (
          <>
            <div style={{ display: "flex", padding: "12px 20px 0", gap: "4px" }}>
              {days.map((d) => {
                const active = d.offset === dayOffset;
                return (
                  <div
                    key={d.iso}
                    onClick={() => setDayOffset(d.offset)}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "7px 0 6px",
                      borderRadius: "6px",
                      background: active ? COLORS.amber : "transparent",
                      color: active ? COLORS.bg : COLORS.dim,
                      border: `1px solid ${active ? COLORS.amber : COLORS.border}`,
                      fontWeight: active ? 600 : 400,
                      fontSize: "10.5px",
                      cursor: "pointer",
                    }}
                  >
                    <div>{chipDayLabel(d.date)}</div>
                    <div style={{ marginTop: "3px", height: "4px", display: "flex", justifyContent: "center" }}>
                      {isoWithRides.has(d.iso) && (
                        <span
                          style={{
                            width: "4px",
                            height: "4px",
                            borderRadius: "50%",
                            background: active ? COLORS.bg : COLORS.amberDim,
                            display: "block",
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: "14px 20px 0", fontSize: "13px", color: COLORS.dim }}>
              {fullDayLabel(selectedDay.date)}
              {windowsForDay.length > 0 && ` · ${windowsForDay.length} route${windowsForDay.length === 1 ? "" : "s"}`}
            </div>
          </>
        )}

        <div>
          {windowsForDay.map(({ rideWindow, occurrence, stale, error }) => (
            <RideDayCard
              key={rideWindow.id}
              rideWindow={rideWindow}
              occurrence={occurrence}
              stale={stale}
              error={error}
              onEdit={() => setModalWindow(rideWindow)}
              onRemove={() => removeRideWindow(rideWindow.id)}
            />
          ))}

          {!loading && rideWindows.length > 0 && windowsForDay.length === 0 && (
            <div style={{ padding: "40px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>
              // no routes scheduled {fullDayLabel(selectedDay.date)}
            </div>
          )}

          {!loading && rideWindows.length === 0 && (
            <div style={{ padding: "40px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>
              // no routes set up yet — add when/where you usually ride
            </div>
          )}

          {windowsWithNoData.map((w) => (
            <div key={w.id} onClick={() => setModalWindow(w)} style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer" }}>
              <div style={{ fontSize: "14.5px", color: COLORS.text, fontWeight: 600 }}>{w.label}</div>
              <div style={{ fontSize: "11px", color: COLORS.danger, marginTop: "4px" }}>couldn't fetch forecast — check connection</div>
            </div>
          ))}
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
