// Indonesian administrative regions
//   Province -> City/Regency -> Kecamatan -> Kelurahan/Desa
// from the free static emsifa API. IDs are official BPS codes and are
// hierarchical: each id starts with its parent's id
// (32 -> 3273 -> 3273010 -> 3273010001). Profiles store these ids (stable)
// alongside the official names; the UI localizes the names for display.
// https://github.com/emsifa/api-wilayah-indonesia
// The old emsifa.github.io host now 301-redirects here without CORS
// headers, so browsers block it; use the final host directly.
import type { Lang } from "@/lib/i18n/translations";

const BASE = "https://www.emsifa.com/api-wilayah-indonesia/api";

export interface WilayahItem {
  id: string;
  /** Official name, title-cased, e.g. "Kota Bandung", "Kabupaten Bandung". */
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
// and in localStorage (versioned keys) instead of re-downloaded per visit.
const PROVINCES_CACHE_KEY = "komunitas-wilayah-provinces-v1";
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

export function getProvinces(): Promise<WilayahItem[]> {
  return cached("provinces", async () => {
    const stored = readCache<WilayahItem[]>(PROVINCES_CACHE_KEY);
    if (stored?.length) return stored;
    const list = await fetchList("provinces.json");
    if (list.length) writeCache(PROVINCES_CACHE_KEY, list);
    return list;
  });
}

/** Every city/regency in Indonesia (~500), for cross-province search. */
export function getAllCities(): Promise<WilayahItem[]> {
  return cached("cities", async () => {
    const stored = readCache<WilayahItem[]>(CITIES_CACHE_KEY);
    if (stored?.length) return stored;

    const provinces = await getProvinces();
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

/** BPS codes are hierarchical: a city id's first two digits are its province. */
export function provinceIdOf(cityId: string): string {
  return cityId.slice(0, 2);
}

// ---------------------------------------------------------------------------
// Display + search
// ---------------------------------------------------------------------------

const PREFIX = /^(kota administrasi|kota|kabupaten administrasi|kabupaten|kab\.|kecamatan|kelurahan|desa)\s+/i;

/** "Kota Bandung" -> "Bandung" (also strips Kabupaten/Kecamatan/Kelurahan/Desa). */
export function stripRegionPrefix(name: string): string {
  return name.replace(PREFIX, "");
}

/**
 * Human-readable city/regency name per language. Indonesian keeps the
 * official "Kota X" / "Kabupaten X"; English shows "X" / "X Regency".
 */
export function regionLabel(name: string, lang: Lang): string {
  if (lang === "id") return name;
  if (/^kabupaten\s+/i.test(name)) return `${stripRegionPrefix(name)} Regency`;
  if (/^kota\s+/i.test(name)) return stripRegionPrefix(name);
  return name;
}

/** Lowercase, strip accents and punctuation: "Tanjung Pinang" / "tanjung-pinang" match. */
export function normalizeSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Approximate coordinates for a selected area (manual-location fallback).
// Uses OpenStreetMap Nominatim, trying the most specific query first.
// ---------------------------------------------------------------------------

const GEOCODE_CACHE_KEY = "komunitas-geocode-v1";

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

// ---------------------------------------------------------------------------
// GPS assist: turn coordinates into Province/City/Kecamatan/Kelurahan
// suggestions by reverse-geocoding (Nominatim) and matching the returned
// names against the official lists. Best effort — any level that can't be
// matched confidently is left empty for the user to pick.
// ---------------------------------------------------------------------------

export interface DetectedArea {
  province?: WilayahItem;
  city?: WilayahItem;
  kecamatan?: WilayahItem;
  kelurahan?: WilayahItem;
}

const bare = (s: string) =>
  normalizeSearch(stripRegionPrefix(s))
    .replace(/^(provinsi|daerah khusus ibukota|daerah istimewa|dki|di)\s+/, "")
    .trim();

/** Find the item whose bare name equals one of the candidates (first candidate wins). */
function matchByName(
  items: WilayahItem[],
  candidates: (string | undefined)[],
  prefer?: (item: WilayahItem) => boolean
): WilayahItem | undefined {
  for (const c of candidates) {
    if (!c) continue;
    const target = bare(c);
    if (!target) continue;
    const hits = items.filter((i) => bare(i.name) === target);
    if (hits.length) return (prefer && hits.find(prefer)) || hits[0];
  }
  return undefined;
}

// ISO 3166-2:ID province code -> BPS province id. The four newer Papua
// provinces map to their parent in this (pre-2022) dataset.
const ISO_TO_BPS_PROVINCE: Record<string, string> = {
  AC: "11", SU: "12", SB: "13", RI: "14", JA: "15", SS: "16", BE: "17", LA: "18",
  BB: "19", KR: "21", JK: "31", JB: "32", JT: "33", YO: "34", JI: "35", BT: "36",
  BA: "51", NB: "52", NT: "53", KB: "61", KT: "62", KS: "63", KI: "64", KU: "65",
  SA: "71", ST: "72", SN: "73", SG: "74", GO: "75", SR: "76", MA: "81", MU: "82",
  PB: "91", PD: "91", PA: "94", PS: "94", PT: "94", PE: "94",
};

export async function detectArea(lat: number, lng: number): Promise<DetectedArea> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=id&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`reverse geocode failed: ${res.status}`);
  const a: Record<string, string | undefined> = (await res.json()).address ?? {};

  const result: DetectedArea = {};

  const provinces = await getProvinces();
  // Prefer the ISO 3166-2 code (always present, e.g. "ID-JK"); fall back to
  // the state name, whose form varies ("Daerah Khusus Ibukota Jakarta" vs
  // "DKI Jakarta") — match the longest official name it contains.
  const isoId = ISO_TO_BPS_PROVINCE[(a["ISO3166-2-lvl4"] ?? "").replace(/^ID-/, "")];
  const state = bare(a.state ?? "");
  result.province =
    provinces.find((p) => p.id === isoId) ??
    (state
      ? provinces
          .filter((p) => state.includes(bare(p.name)))
          .sort((x, y) => bare(y.name).length - bare(x.name).length)[0]
      : undefined);
  if (!result.province) return result;

  const cities = (await getAllCities()).filter((c) => provinceIdOf(c.id) === result.province!.id);
  const isKota = (c: WilayahItem) => /^kota\s/i.test(c.name);
  result.city =
    matchByName(cities, [a.city], isKota) ??
    matchByName(cities, [a.county, a.regency, a.state_district], (c) => !isKota(c)) ??
    // Jakarta reports its cities (Jakarta Pusat, …) as city_district.
    matchByName(cities, [a.city_district, a.town, a.municipality]);
  if (!result.city) return result;

  const districts = await getDistricts(result.city.id);
  result.kecamatan = matchByName(districts, [a.city_district, a.district, a.subdistrict, a.suburb, a.municipality]);
  if (!result.kecamatan) return result;

  const villages = await getVillages(result.kecamatan.id);
  result.kelurahan = matchByName(villages, [a.village, a.suburb, a.quarter, a.neighbourhood, a.hamlet]);
  return result;
}
