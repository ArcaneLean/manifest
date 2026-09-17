// Weather app forecast logic — see ARCHITECTURE.md §7 ("Weather"). Turns a
// RideWindow's weekly recurrence + a raw multi-model Open-Meteo response
// into per-occurrence aggregates, a wind-favorability reading relative to
// the window's optional travel heading, and a plain-language verdict.

import { timeToMinutes } from "./timeUtils.js";
import { toISO, addDays, startOfToday } from "./dateUtils.js";
import { MODELS } from "./openMeteo.js";

// Occurrences shown per window — stays inside openMeteo.js's FORECAST_DAYS
// so every occurrence returned here actually has forecast data behind it.
// Exported so the day-switcher UI can navigate exactly this range.
export const HORIZON_DAYS = 7;

// Thresholds are a cycling-specific judgment call, not a general weather
// classification — e.g. 35km/h gusts are a shrug in a car but noticeable on
// a bike. "spread" thresholds flag when models disagree enough to be worth
// a second look, independent of what any single model says.
const POOR = { precipMm: 1, gustKmh: 50, tempC: 2 };
const CAUTION = { precipMm: 0.2, gustKmh: 35, tempC: 7, precipSpreadMm: 1, gustSpreadKmh: 15 };

// Headwind is the wind condition that actually costs a cyclist effort —
// unlike gusts (a general hazard threshold above), a steady headwind is
// only worth flagging when the rider has told us which way they're going.
const HEADWIND_POOR_KMH = 30;
const HEADWIND_CAUTION_KMH = 18;

// 8-point compass, degrees = bearing. Used both for a RideWindow's stored
// travel heading and for describing which way the wind is coming from.
export const COMPASS_POINTS = [
  { deg: 0, label: "N", arrow: "↑" },
  { deg: 45, label: "NE", arrow: "↗" },
  { deg: 90, label: "E", arrow: "→" },
  { deg: 135, label: "SE", arrow: "↘" },
  { deg: 180, label: "S", arrow: "↓" },
  { deg: 225, label: "SW", arrow: "↙" },
  { deg: 270, label: "W", arrow: "←" },
  { deg: 315, label: "NW", arrow: "↖" },
];

function angularDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function nearestCompassPoint(deg) {
  if (deg == null) return null;
  return COMPASS_POINTS.reduce((closest, p) => {
    const d = angularDiff(p.deg, deg);
    return !closest || d < closest.d ? { d, point: p } : closest;
  }, null).point;
}

// Circular mean — plain averaging breaks on directions that straddle
// 0°/360° (e.g. 350° and 10° should average to 0°, not 180°).
function circularMeanDeg(degrees) {
  if (degrees.length === 0) return null;
  let sumSin = 0;
  let sumCos = 0;
  for (const d of degrees) {
    const rad = (d * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
  }
  let mean = (Math.atan2(sumSin, sumCos) * 180) / Math.PI;
  if (mean < 0) mean += 360;
  return mean;
}

// How the wind relates to a cycling heading: `headingDeg` is the direction
// the rider is traveling *toward*; `windFromDeg` is the direction
// Open-Meteo reports the wind coming *from*. Wind coming from roughly where
// you're heading blows straight into you (headwind); from roughly behind
// you, it pushes you along (tailwind).
export function windRelation(headingDeg, windFromDeg) {
  if (headingDeg == null || windFromDeg == null) return null;
  const diff = angularDiff(headingDeg, windFromDeg);
  if (diff <= 45) return "headwind";
  if (diff >= 135) return "tailwind";
  return "crosswind";
}

// One consensus wind reading for an occurrence — averaged across whichever
// models reported a direction — plus how it relates to the window's travel
// heading. Null when no heading is set, so windows without one skip this
// entirely rather than showing a meaningless relation.
function summarizeWind(aggregates, headingDeg) {
  if (headingDeg == null) return null;
  const withDir = Object.values(aggregates).filter((v) => v?.windDir != null);
  if (withDir.length === 0) return null;
  const speedKmh = withDir.reduce((a, v) => a + v.wind, 0) / withDir.length;
  const dirDeg = circularMeanDeg(withDir.map((v) => v.windDir));
  return { relation: windRelation(headingDeg, dirDeg), speedKmh, dirDeg };
}

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
  const windDirs = pick("wind_direction_10m");
  if (temps.length === 0) return null;
  return {
    temp: temps.reduce((a, b) => a + b, 0) / temps.length,
    precip: precip.reduce((a, b) => a + b, 0),
    wind: Math.max(...wind, 0),
    gust: Math.max(...gust, 0),
    windDir: circularMeanDeg(windDirs),
  };
}

// Plain-language verdict from per-model aggregates. Severity is driven by
// the worst model (a cyclist who only saw the optimistic one still gets
// caught out), separately from `disagreement`, which flags when models
// diverge enough that "the forecast" isn't really settled.
export function classifyOccurrence(aggregates, wind = null) {
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

  if (wind?.relation === "headwind") {
    if (wind.speedKmh >= HEADWIND_POOR_KMH) poorReasons.push(`strong headwind ~${Math.round(wind.speedKmh)}km/h`);
    else if (wind.speedKmh >= HEADWIND_CAUTION_KMH) cautionReasons.push(`headwind ~${Math.round(wind.speedKmh)}km/h`);
  }

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
    const wind = summarizeWind(aggregates, rideWindow.direction);
    return { ...occ, aggregates, wind, verdict: classifyOccurrence(aggregates, wind) };
  });
}
