import { useRef, useState } from "react";
import { X, Search } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { DAY_LABELS } from "../lib/recurrence.js";
import { geocodeLocation } from "../lib/openMeteo.js";
import { COMPASS_POINTS } from "../lib/cyclingWeather.js";

function formatCandidate(c) {
  return [c.name, c.admin1, c.country].filter(Boolean).join(", ");
}

// Add/edit a RideWindow — a whole commute route (label, one or more stops,
// weekly days, time-of-day range). `rideWindow` is null when adding, an
// existing record when editing — mirrors TemplateEditModal's shape for the
// same reason (one modal, two modes).
export function RideWindowEditModal({ rideWindow, onSave, onClose }) {
  const [label, setLabel] = useState(rideWindow?.label || "");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [stops, setStops] = useState(rideWindow?.stops || []);
  const [days, setDays] = useState(rideWindow?.days || [5, 6]);
  const [startTime, setStartTime] = useState(rideWindow?.startTime || "09:00");
  const [endTime, setEndTime] = useState(rideWindow?.endTime || "12:00");
  const [direction, setDirection] = useState(rideWindow?.direction ?? null);
  const labelRef = useRef(null);

  const toggleDay = (d) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    setSearchError(null);
    try {
      const results = await geocodeLocation(trimmed);
      setCandidates(results);
      if (results.length === 0) setSearchError("no matches");
    } catch {
      setSearchError("search failed — check connection");
    } finally {
      setSearching(false);
    }
  };

  const addCandidate = (c) => {
    setStops((prev) => [...prev, { label: formatCandidate(c), lat: c.lat, lon: c.lon }]);
    setQuery("");
    setCandidates([]);
  };

  const removeStop = (i) => {
    setStops((prev) => prev.filter((_, idx) => idx !== i));
  };

  const canSave = label.trim().length > 0 && stops.length > 0 && days.length > 0 && startTime < endTime;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      label: label.trim(),
      stops,
      days,
      startTime,
      endTime,
      direction,
    });
  };

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
          maxHeight: "88vh",
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
            {rideWindow ? "edit route" : "new route"}
          </span>
          <span onClick={onClose} style={{ cursor: "pointer" }}>
            <X size={16} color={COLORS.dim} />
          </span>
        </div>

        <input
          ref={labelRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="label, e.g. morning commute"
          style={{
            width: "100%",
            background: "transparent",
            border: `1px solid ${COLORS.border}`,
            borderRadius: "6px",
            outline: "none",
            color: COLORS.text,
            caretColor: COLORS.amber,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "14.5px",
            padding: "10px",
            marginBottom: "12px",
            boxSizing: "border-box",
          }}
        />

        <div style={{ fontSize: "10.5px", color: COLORS.dim, marginBottom: "6px" }}>
          stops <span style={{ opacity: 0.7 }}>(everywhere along the route)</span>
        </div>

        {stops.length > 0 && (
          <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: "6px", marginBottom: "10px", overflow: "hidden" }}>
            {stops.map((s, i) => (
              <div
                key={`${s.lat},${s.lon},${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  padding: "9px 10px",
                  fontSize: "12.5px",
                  color: COLORS.text,
                  borderTop: i > 0 ? `1px solid ${COLORS.border}` : "none",
                }}
              >
                <span>{s.label}</span>
                <span onClick={() => removeStop(i)} style={{ cursor: "pointer", flexShrink: 0 }}>
                  <X size={13} color={COLORS.dim} />
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
            }}
            placeholder="search a place to add"
            style={{
              flex: 1,
              background: "transparent",
              border: `1px solid ${COLORS.border}`,
              borderRadius: "6px",
              outline: "none",
              color: COLORS.text,
              caretColor: COLORS.amber,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "13.5px",
              padding: "9px 10px",
              boxSizing: "border-box",
              minWidth: 0,
            }}
          />
          <button
            onClick={runSearch}
            disabled={searching || !query.trim()}
            style={{
              background: "none",
              border: `1px solid ${COLORS.border}`,
              color: COLORS.dim,
              borderRadius: "6px",
              padding: "0 12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            aria-label="search"
          >
            <Search size={15} />
          </button>
        </div>

        {searchError && <div style={{ fontSize: "11.5px", color: COLORS.danger, marginBottom: "8px" }}>{searchError}</div>}

        {candidates.length > 0 && (
          <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: "6px", marginBottom: "8px", overflow: "hidden" }}>
            {candidates.map((c, i) => (
              <div
                key={`${c.lat},${c.lon}`}
                onClick={() => addCandidate(c)}
                style={{
                  padding: "9px 10px",
                  fontSize: "12.5px",
                  color: COLORS.text,
                  cursor: "pointer",
                  borderTop: i > 0 ? `1px solid ${COLORS.border}` : "none",
                }}
              >
                {formatCandidate(c)}
              </div>
            ))}
          </div>
        )}
        {candidates.length === 0 && !searchError && <div style={{ marginBottom: "14px" }} />}

        <div style={{ fontSize: "10.5px", color: COLORS.dim, marginBottom: "6px" }}>days</div>
        <div style={{ display: "flex", gap: "4px", marginBottom: "14px" }}>
          {DAY_LABELS.map((dayLabel, i) => {
            const active = days.includes(i);
            return (
              <span
                key={i}
                onClick={() => toggleDay(i)}
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: "10.5px",
                  padding: "6px 0",
                  borderRadius: "5px",
                  background: active ? COLORS.amber : "transparent",
                  color: active ? COLORS.bg : COLORS.dim,
                  border: `1px solid ${active ? COLORS.amber : COLORS.border}`,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {dayLabel}
              </span>
            );
          })}
        </div>

        <div style={{ fontSize: "10.5px", color: COLORS.dim, marginBottom: "6px" }}>time window</div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            style={{
              background: "transparent",
              border: `1px solid ${COLORS.border}`,
              borderRadius: "6px",
              outline: "none",
              color: COLORS.text,
              caretColor: COLORS.amber,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "13.5px",
              padding: "8px 10px",
              colorScheme: "dark",
            }}
          />
          <span style={{ color: COLORS.dim, fontSize: "12px" }}>to</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            style={{
              background: "transparent",
              border: `1px solid ${COLORS.border}`,
              borderRadius: "6px",
              outline: "none",
              color: COLORS.text,
              caretColor: COLORS.amber,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "13.5px",
              padding: "8px 10px",
              colorScheme: "dark",
            }}
          />
        </div>
        {startTime >= endTime && (
          <div style={{ fontSize: "11.5px", color: COLORS.danger, marginBottom: "10px", marginTop: "-8px" }}>
            end time must be after start time
          </div>
        )}

        <div style={{ fontSize: "10.5px", color: COLORS.dim, marginBottom: "6px" }}>
          cycling direction <span style={{ opacity: 0.7 }}>(optional — for wind favorability)</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px", marginBottom: "16px" }}>
          {COMPASS_POINTS.map((p) => {
            const active = direction === p.deg;
            return (
              <span
                key={p.deg}
                onClick={() => setDirection(active ? null : p.deg)}
                style={{
                  textAlign: "center",
                  fontSize: "11px",
                  padding: "6px 0",
                  borderRadius: "5px",
                  background: active ? COLORS.amber : "transparent",
                  color: active ? COLORS.bg : COLORS.dim,
                  border: `1px solid ${active ? COLORS.amber : COLORS.border}`,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {p.arrow} {p.label}
              </span>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: `1px solid ${COLORS.border}`,
              color: COLORS.dim,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12.5px",
              padding: "7px 14px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              background: canSave ? COLORS.amber : COLORS.border,
              border: "none",
              color: canSave ? COLORS.bg : COLORS.dim,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12.5px",
              fontWeight: 600,
              padding: "7px 14px",
              borderRadius: "6px",
              cursor: canSave ? "pointer" : "default",
            }}
          >
            save
          </button>
        </div>
      </div>
    </div>
  );
}
