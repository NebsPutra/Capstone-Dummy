import { clsx, type ClassValue } from "clsx";
import type { Lang } from "@/lib/i18n/translations";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export const DASHBOARD_RADIUS_KM = 20;
export const APP_TIME_ZONE = "Asia/Jakarta";

/** Haversine distance in km between two lat/lng points (matches SQL haversine_km). */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function locale(lang: Lang) {
  return lang === "id" ? "id-ID" : "en-US";
}

export function formatDistance(km: number, lang: Lang): string {
  if (km < 1) {
    const m = Math.round(km * 1000);
    return lang === "id" ? `${m} m dari sini` : `${m} m away`;
  }
  const n = km.toLocaleString(locale(lang), { maximumFractionDigits: 1 });
  return lang === "id" ? `${n} km dari sini` : `${n} km away`;
}

// ---------------------------------------------------------------------------
// Dates & times. Events store a local Asia/Jakarta date + wall-clock time
// with no timezone. Never round-trip them through UTC (toISOString), or
// events near midnight shift by a day.
// ---------------------------------------------------------------------------

/** YYYY-MM-DD for "today" in Jakarta, regardless of server/browser timezone. */
export function jakartaToday(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** "YYYY-MM-DDTHH:MM" for the current Jakarta wall-clock time (sortable string). */
export function jakartaNowStamp(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Sortable "YYYY-MM-DDTHH:MM" stamp for an event date + time. */
export function eventStamp(date: string, time: string): string {
  return `${date}T${time.slice(0, 5)}`;
}

export function formatDate(dateStr: string, lang: Lang): string {
  // Parse as a plain calendar date at UTC noon and format in UTC, so the
  // weekday/day never drifts with the viewer's timezone.
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString(locale(lang), {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)} WIB`;
}

// ---------------------------------------------------------------------------
// Money. `events.fee` is whole Rupiah stored as numeric. The DB value is the
// only source of truth; the UI formats it per language and never stores
// formatted text.
// ---------------------------------------------------------------------------

/** Coerce a DB fee (numeric can arrive as number or string) to whole Rupiah. */
export function toFee(fee: number | string | null | undefined): number {
  const n = typeof fee === "string" ? Number(fee) : fee ?? 0;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Rupiah amount without the "Free" special case: "Rp25.000" / "IDR 25,000". */
export function formatRupiah(amount: number, lang: Lang): string {
  const n = Math.round(amount).toLocaleString(locale(lang));
  return lang === "id" ? `Rp${n}` : `IDR ${n}`;
}

export function formatFee(fee: number | string | null | undefined, lang: Lang): string {
  const n = toFee(fee);
  if (n === 0) return lang === "id" ? "Gratis" : "Free";
  return formatRupiah(n, lang);
}

/** Digits-only parse for the fee input ("25.000", "25,000", "Rp 25000" -> 25000). */
export function parseRupiahInput(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

/** Group digits for display inside the fee input while typing. */
export function groupDigits(n: number, lang: Lang): string {
  return n.toLocaleString(locale(lang));
}
