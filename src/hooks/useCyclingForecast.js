import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchForecast } from "../lib/openMeteo.js";
import { getCachedForecast, putCachedForecast, locationKey } from "../lib/weatherCacheRepo.js";
import { forecastForRoute } from "../lib/cyclingWeather.js";

// Forecasts change slowly enough (and Open-Meteo's free tier is rate
// limited) that re-fetching on every app open isn't worth it — reuse a
// cached response until it's this old, otherwise fall back to it (marked
// stale) if a refetch fails, e.g. offline.
const TTL_MS = 45 * 60 * 1000;

// Fetches (and IndexedDB-caches) one forecast per unique location among all
// stops of the given routes, then combines each route's own stops into its
// own per-occurrence forecast (see cyclingWeather.js's forecastForRoute).
// Stops shared across routes, or repeated within one route, share a fetch.
export function useCyclingForecast(rideWindows) {
  const [byLocation, setByLocation] = useState({});
  const [loading, setLoading] = useState(false);

  const locations = useMemo(() => {
    const map = new Map();
    for (const w of rideWindows) {
      for (const stop of w.stops) {
        const key = locationKey(stop.lat, stop.lon);
        if (!map.has(key)) map.set(key, { key, lat: stop.lat, lon: stop.lon });
      }
    }
    return [...map.values()];
  }, [rideWindows]);

  const signature = locations
    .map((l) => l.key)
    .sort()
    .join("|");

  const load = useCallback(
    async (forceRefresh) => {
      if (locations.length === 0) {
        setByLocation({});
        return;
      }
      setLoading(true);
      const entries = await Promise.all(
        locations.map(async (loc) => {
          const cached = await getCachedForecast(loc.key);
          const isFresh = cached && Date.now() - cached.fetchedAt < TTL_MS;
          if (isFresh && !forceRefresh) {
            return [loc.key, { forecast: cached.forecast, fetchedAt: cached.fetchedAt, stale: false, error: null }];
          }
          try {
            const forecast = await fetchForecast(loc.lat, loc.lon);
            const fetchedAt = Date.now();
            await putCachedForecast({ key: loc.key, forecast, fetchedAt });
            return [loc.key, { forecast, fetchedAt, stale: false, error: null }];
          } catch (err) {
            if (cached) return [loc.key, { forecast: cached.forecast, fetchedAt: cached.fetchedAt, stale: true, error: err }];
            return [loc.key, { forecast: null, fetchedAt: null, stale: false, error: err }];
          }
        })
      );
      setByLocation(Object.fromEntries(entries));
      setLoading(false);
    },
    [locations]
  );

  useEffect(() => {
    load(false);
    // Only re-runs when the *set* of locations changes, not on every
    // rideWindows edit (label/time tweaks don't need a refetch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const forecastsByWindow = {};
  for (const w of rideWindows) {
    const stopEntries = w.stops.map((stop) => byLocation[locationKey(stop.lat, stop.lon)]);
    forecastsByWindow[w.id] = {
      occurrences: forecastForRoute(w, stopEntries.map((e) => e?.forecast ?? null)),
      fetchedAt: stopEntries.reduce((max, e) => (e?.fetchedAt && e.fetchedAt > (max ?? 0) ? e.fetchedAt : max), null),
      stale: stopEntries.some((e) => e?.stale),
      error: stopEntries.find((e) => e?.error)?.error ?? null,
    };
  }

  return { forecastsByWindow, loading, refresh: () => load(true) };
}
