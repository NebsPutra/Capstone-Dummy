// Indonesian administrative regions (City/Regency -> Kecamatan -> Kelurahan)
// from the free static emsifa API. IDs are official BPS codes and are
// hierarchical: a kelurahan id starts with its kecamatan id, which starts
// with its city id (e.g. 3273 -> 3273010 -> 3273010001). Profiles store
// these ids (stable) alongside the display names.
// https://github.com/emsifa/api-wilayah-indonesia
// The old emsifa.github.io host now 301-redirects here without CORS
// headers, so browsers block it; use the final host directly.
const BASE = "https://www.emsifa.com/api-wilayah-indonesia/api";

export interface WilayahItem {
  id: string;
  name: string;
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bDki\b/g, "DKI")
    .replace(/\bDi\b/g, "DI");
}

function readCache<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private mode — the in-memory cache still works
  }
}

// The region lists are static reference data, so they're cached in memory
// and in localStorage (versioned key) instead of re-downloaded per visit.
const CITIES_CACHE_KEY = "komunitas-wilayah-cities-v1";
const memo = new Map<string, Promise<WilayahItem[]>>();

function cached(key: string, load: () => Promise<WilayahItem[]>): Promise<WilayahItem[]> {
  const existing = memo.get(key);
  if (existing) return existing;
  const promise = load().catch((err) => {
    memo.delete(key); // don't cache failures — let the next call retry
    throw err;
  });
  memo.set(key, promise);
  return promise;
}

async function fetchList(path: string): Promise<WilayahItem[]> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`wilayah fetch failed: ${path} ${res.status}`);
  const data: { id: string; name: string }[] = await res.json();
  return data
    .map((d) => ({ id: d.id, name: toTitleCase(d.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export function getAllCities(): Promise<WilayahItem[]> {
  return cached("cities", async () => {
    const stored = readCache<WilayahItem[]>(CITIES_CACHE_KEY);
    if (stored?.length) return stored;

    const provinces = await fetchList("provinces.json");
    const lists = await Promise.all(
      provinces.map((p) => fetchList(`regencies/${p.id}.json`).catch(() => []))
    );
    const all = lists.flat().sort((a, b) => a.name.localeCompare(b.name, "id"));
    if (all.length) writeCache(CITIES_CACHE_KEY, all);
    return all;
  });
}

export function getDistricts(cityId: string): Promise<WilayahItem[]> {
  return cached(`districts:${cityId}`, () => fetchList(`districts/${cityId}.json`));
}

export function getVillages(kecamatanId: string): Promise<WilayahItem[]> {
  return cached(`villages:${kecamatanId}`, () => fetchList(`villages/${kecamatanId}.json`));
}

// ---------------------------------------------------------------------------
// Approximate coordinates for a selected area (manual-location fallback).
// Uses OpenStreetMap Nominatim, trying the most specific query first.
// ---------------------------------------------------------------------------

const GEOCODE_CACHE_KEY = "komunitas-geocode-v1";

function stripRegionPrefix(name: string): string {
  return name.replace(/^(Kota|Kabupaten|Kab\.)\s+/i, "");
}

export async function geocodeArea(area: {
  city: string;
  kecamatan?: string;
  kelurahan?: string;
}): Promise<{ lat: number; lng: number } | null> {
  const city = stripRegionPrefix(area.city);
  const queries = [
    area.kelurahan && area.kecamatan ? `${area.kelurahan}, ${area.kecamatan}, ${city}` : null,
    area.kecamatan ? `${area.kecamatan}, ${city}` : null,
    city,
  ].filter((q): q is string => Boolean(q));

  const cache = readCache<Record<string, { lat: number; lng: number }>>(GEOCODE_CACHE_KEY) ?? {};

  for (const q of queries) {
    if (cache[q]) return cache[q];
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=id&q=${encodeURIComponent(
        `${q}, Indonesia`
      )}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const data: { lat: string; lon: string }[] = await res.json();
      if (data[0]) {
        const point = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
        writeCache(GEOCODE_CACHE_KEY, { ...cache, [q]: point });
        return point;
      }
    } catch (err) {
      console.error("[komunitas] geocode failed:", err);
    }
  }
  return null;
}
