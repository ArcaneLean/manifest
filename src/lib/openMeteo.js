// Open-Meteo client — see ARCHITECTURE.md §7 ("Weather"). Free, keyless, CORS-
// enabled, and lets one request return several independent forecast models,
// which is what makes "check different sources" possible with no backend
// (per §1's no-server-proxy constraint) — unlike most other providers, which
// need either an API key or a User-Agent header the browser won't let JS set.

// Three independently-run global NWP models, not three re-skins of the same
// underlying data — the point of comparing sources at all.
export const MODELS = [
  { key: "ecmwf_ifs025", label: "ECMWF" },
  { key: "gfs_seamless", label: "GFS" },
  { key: "icon_seamless", label: "ICON" },
];

const FORECAST_DAYS = 8;

export async function geocodeLocation(query) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocoding failed (${res.status})`);
  const data = await res.json();
  return (data.results || []).map((r) => ({
    name: r.name,
    admin1: r.admin1 || "",
    country: r.country || "",
    lat: r.latitude,
    lon: r.longitude,
  }));
}

const VARS = ["temperature_2m", "precipitation", "wind_speed_10m", "wind_gusts_10m", "wind_direction_10m"];

// Raw {time, perModel: {modelKey: {temperature_2m: [], precipitation: [], ...}}}
// hourly forecast for one location, `FORECAST_DAYS` ahead. Left un-aggregated
// here — cyclingWeather.js slices it per ride window.
export async function fetchForecast(lat, lon) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lon);
  url.searchParams.set("hourly", VARS.join(","));
  url.searchParams.set("models", MODELS.map((m) => m.key).join(","));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(FORECAST_DAYS));
  url.searchParams.set("wind_speed_unit", "kmh");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`forecast fetch failed (${res.status})`);
  const data = await res.json();
  const hourly = data.hourly || {};
  const perModel = {};
  for (const { key } of MODELS) {
    perModel[key] = {};
    for (const v of VARS) perModel[key][v] = hourly[`${v}_${key}`] || [];
  }
  return { time: hourly.time || [], perModel };
}
