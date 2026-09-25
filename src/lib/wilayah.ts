// Free, public, static-file API for Indonesian administrative regions.
// https://github.com/emsifa/api-wilayah-indonesia
const BASE = "https://emsifa.github.io/api-wilayah-indonesia/api";

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

// The "all cities" list requires merging regencies across every province,
// so it's cached in memory after the first successful fetch (session-lived,
// not persisted). A failed fetch is cached as null so the next call retries.
let citiesCache: WilayahItem[] | null = null;
let citiesPromise: Promise<WilayahItem[]> | null = null;

export async function getAllCities(): Promise<WilayahItem[]> {
  if (citiesCache) return citiesCache;
  if (citiesPromise) return citiesPromise;

  citiesPromise = (async () => {
    try {
      const provRes = await fetch(`${BASE}/provinces.json`);
      if (!provRes.ok) throw new Error(`provinces fetch failed: ${provRes.status}`);
      const provinces: { id: string; name: string }[] = await provRes.json();

      const regencyLists = await Promise.all(
        provinces.map((p) =>
          fetch(`${BASE}/regencies/${p.id}.json`)
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => [])
        )
      );

      const all: WilayahItem[] = regencyLists
        .flat()
        .map((r: any) => ({ id: r.id, name: toTitleCase(r.name) }));

      all.sort((a, b) => a.name.localeCompare(b.name));
      citiesCache = all;
      return all;
    } catch (err) {
      // Don't cache a failure — let the next attempt retry the network call.
      citiesPromise = null;
      throw err;
    }
  })();

  return citiesPromise;
}

export async function getDistricts(regencyId: string): Promise<WilayahItem[]> {
  const res = await fetch(`${BASE}/districts/${regencyId}.json`);
  if (!res.ok) throw new Error(`districts fetch failed: ${res.status}`);
  const data = await res.json();
  return (data as any[])
    .map((d) => ({ id: d.id, name: toTitleCase(d.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getVillages(districtId: string): Promise<WilayahItem[]> {
  const res = await fetch(`${BASE}/villages/${districtId}.json`);
  if (!res.ok) throw new Error(`villages fetch failed: ${res.status}`);
  const data = await res.json();
  return (data as any[])
    .map((v) => ({ id: v.id, name: toTitleCase(v.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
