// Generic time helpers ("HH:MM" <-> minutes, duration formatting). The
// Hours-specific day/week math lives in lib/hours2/ — see ARCHITECTURE.md §7
// ("Hours 2.0").

export function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(min) {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Signed variant for balance figures (formatMinutes mishandles negatives —
// JS's % keeps the sign of the dividend, e.g. -70 % 60 === -10).
export function formatSignedMinutes(min) {
  const sign = min < 0 ? "-" : "+";
  return `${sign}${formatMinutes(Math.abs(min))}`;
}

export function nowHHMM(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
