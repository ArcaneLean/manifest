// Weather app forecast logic — see ARCHITECTURE.md §7 ("Weather"). Turns a
// RideWindow's weekly recurrence + a raw multi-model Open-Meteo response
// into per-occurrence aggregates and a plain-language verdict.

import { timeToMinutes } from "./timeUtils.js";
import { toISO, addDays, startOfToday } from "./dateUtils.js";
import { MODELS } from "./openMeteo.js";

// Occurrences shown per window — stays inside openMeteo.js's FORECAST_DAYS
// so every occurrence returned here actually has forecast data behind it.
const HORIZON_DAYS = 7;

// Thresholds are a cycling-specific judgment call, not a general weather
// classification — e.g. 35km/h gusts are a shrug in a car but noticeable on
// a bike. "spread" thresholds flag when models disagree enough to be worth
// a second look, independent of what any single model says.
const POOR = { precipMm: 1, gustKmh: 50, tempC: 2 };
const CAUTION = { precipMm: 0.2, gustKmh: 35, tempC: 7, precipSpreadMm: 1, gustSpreadKmh: 15 };

// This week's dates (today included) that fall on one of the window's
// weekly days and haven't already ended today.
export function upcomingOccurrences(rideWindow, now = new Date()) {
  const today = startOfToday();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const occurrences = [];
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const date = addDays(today, i);
    const weekday = (date.getDay() + 6) % 7; // 0=Mon..6=Sun, matches Template.recurring
    if (!rideWindow.days.includes(weekday)) continue;
    if (i === 0 && timeToMinutes(rideWindow.endTime) <= nowMin) continue;
    occurrences.push({ date, iso: toISO(date) });
  }
  return occurrences;
}

// Hourly forecast indices whose local time falls in [startTime, endTime) on
// `iso`. Falls back to the single closest hour when the window is narrower
// than the model's hourly resolution (e.g. a 30-minute commute window).
function hoursInWindow(forecast, iso, startTime, endTime) {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const inWindow = [];
  let nearestIdx = -1;
  let nearestDiff = Infinity;
  const midMin = (startMin + endMin) / 2;
  forecast.time.forEach((t, idx) => {
    if (!t.startsWith(iso)) return;
    const min = timeToMinutes(t.slice(11, 16));
    if (min >= startMin && min < endMin) inWindow.push(idx);
    const diff = Math.abs(min - midMin);
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearestIdx = idx;
    }
  });
  if (inWindow.length > 0) return inWindow;
  return nearestIdx === -1 ? [] : [nearestIdx];
}

function aggregateModel(forecast, modelKey, indices) {
  const series = forecast.perModel[modelKey];
  if (!series) return null;
  const pick = (field) => indices.map((i) => series[field][i]).filter((v) => v != null);
  const temps = pick("temperature_2m");
  const precip = pick("precipitation");
  const wind = pick("wind_speed_10m");
  const gust = pick("wind_gusts_10m");
  if (temps.length === 0) return null;
  return {
    temp: temps.reduce((a, b) => a + b, 0) / temps.length,
    precip: precip.reduce((a, b) => a + b, 0),
    wind: Math.max(...wind, 0),
    gust: Math.max(...gust, 0),
  };
}

// Plain-language verdict from per-model aggregates. Severity is driven by
// the worst model (a cyclist who only saw the optimistic one still gets
// caught out), separately from `disagreement`, which flags when models
// diverge enough that "the forecast" isn't really settled.
export function classifyOccurrence(aggregates) {
  const values = Object.values(aggregates).filter(Boolean);
  if (values.length === 0) return { level: "unknown", reasons: [], disagreement: false };

  const maxPrecip = Math.max(...values.map((v) => v.precip));
  const minPrecip = Math.min(...values.map((v) => v.precip));
  const maxGust = Math.max(...values.map((v) => v.gust));
  const minGust = Math.min(...values.map((v) => v.gust));
  const minTemp = Math.min(...values.map((v) => v.temp));

  const poorReasons = [];
  const cautionReasons = [];

  if (maxPrecip >= POOR.precipMm) poorReasons.push(`rain up to ${maxPrecip.toFixed(1)}mm`);
  else if (maxPrecip >= CAUTION.precipMm) cautionReasons.push(`light rain possible (${maxPrecip.toFixed(1)}mm)`);

  if (maxGust >= POOR.gustKmh) poorReasons.push(`gusts to ${Math.round(maxGust)}km/h`);
  else if (maxGust >= CAUTION.gustKmh) cautionReasons.push(`breezy, gusts to ${Math.round(maxGust)}km/h`);

  if (minTemp <= POOR.tempC) poorReasons.push(`cold, ${Math.round(minTemp)}°C`);
  else if (minTemp <= CAUTION.tempC) cautionReasons.push(`cool, ${Math.round(minTemp)}°C`);

  const disagreement = maxPrecip - minPrecip >= CAUTION.precipSpreadMm || maxGust - minGust >= CAUTION.gustSpreadKmh;

  let level = "good";
  if (poorReasons.length > 0) level = "poor";
  else if (cautionReasons.length > 0 || disagreement) level = "caution";

  const reasons = [...poorReasons, ...cautionReasons];
  if (disagreement) reasons.push("sources disagree");

  return { level, reasons, disagreement };
}

// Full per-occurrence forecast for one ride window: upcoming dates, each
// with per-model aggregates over its time-of-day window and a verdict.
export function forecastForRideWindow(rideWindow, forecast, now = new Date()) {
  if (!forecast) return [];
  return upcomingOccurrences(rideWindow, now).map((occ) => {
    const indices = hoursInWindow(forecast, occ.iso, rideWindow.startTime, rideWindow.endTime);
    const aggregates = {};
    for (const { key } of MODELS) aggregates[key] = aggregateModel(forecast, key, indices);
    return { ...occ, aggregates, verdict: classifyOccurrence(aggregates) };
  });
}
