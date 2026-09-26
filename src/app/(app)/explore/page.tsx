"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ActivityCard } from "@/components/ActivityCard";
import { EventCodeJump } from "@/components/EventCodeJump";
import { LocationBar } from "@/components/NearbyDashboard";
import { ManualLocationDialog } from "@/components/ManualLocationDialog";
import { Alert } from "@/components/ui";
import { useUserLocation } from "@/lib/location";
import { effectiveStatus } from "@/lib/events";
import { friendlyErrorKey } from "@/lib/errors";
import { distanceKm, jakartaNowStamp, jakartaToday } from "@/lib/utils";
import { EVENT_LIST_SELECT, type Category, type EventRecord } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";

const TIME_FILTERS = ["today", "tomorrow", "thisWeek", "upcoming", "ongoing"] as const;
const PRICE_FILTERS = ["free", "paid"] as const;
const DISTANCE_OPTIONS = [1, 5, 10, 20, 50];
const PAGE_SIZE = 30;

type TimeFilter = (typeof TIME_FILTERS)[number];
type PriceFilter = (typeof PRICE_FILTERS)[number];

/**
 * Explore is intentionally NOT limited to 20 km: people can search by name,
 * place or event code at any distance. Distance chips are optional filters.
 */
export default function ExplorePage() {
  const supabase = useMemo(() => createClient(), []);
  const { t, td } = useLanguage();
  const { location, setManual, switchToGps } = useUserLocation({ autoPrompt: false });

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter | null>(null);
  const [priceFilter, setPriceFilter] = useState<PriceFilter | null>(null);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [nearestFirst, setNearestFirst] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<TranslationKey | null>(null);

  const coords = location.status === "ready" ? { lat: location.lat, lng: location.lng } : null;

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .then(({ data }) => setCategories(data ?? []));
  }, [supabase]);

  // Debounce typing so every keystroke isn't a request.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Reset paging whenever the server-side filters change.
  useEffect(() => {
    setPage(0);
  }, [debounced, activeCategory, timeFilter, priceFilter]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const today = jakartaToday();
      const nowTime = jakartaNowStamp().slice(11); // HH:MM

      let q = supabase
        .from("events")
        .select(EVENT_LIST_SELECT)
        .eq("privacy", "public")
        .neq("status", "cancelled")
        .order("event_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (debounced) {
        // Strip characters that have meaning in PostgREST filter syntax.
        const term = debounced.replace(/[,()*%\\]/g, " ").trim();
        if (term) {
          q = q.or(
            `title.ilike.%${term}%,location_name.ilike.%${term}%,address.ilike.%${term}%,event_code.ilike.%${term}%`
          );
        }
      }
      if (activeCategory) q = q.eq("category_id", activeCategory);

      if (timeFilter === "today") q = q.eq("event_date", today);
      else if (timeFilter === "tomorrow") q = q.eq("event_date", jakartaToday(1));
      else if (timeFilter === "thisWeek") q = q.gte("event_date", today).lte("event_date", jakartaToday(7));
      else if (timeFilter === "upcoming")
        q = q.or(`event_date.gt.${today},and(event_date.eq.${today},start_time.gt.${nowTime})`);
      else if (timeFilter === "ongoing")
        q = q.eq("event_date", today).lte("start_time", nowTime).gt("end_time", nowTime);
      else q = q.gte("event_date", today); // hide past days by default

      if (priceFilter === "free") q = q.eq("fee", 0);
      if (priceFilter === "paid") q = q.gt("fee", 0);

      const from = page * PAGE_SIZE;
      const { data, error: loadError } = await q.range(from, from + PAGE_SIZE - 1);
      if (cancelled) return;
      if (loadError) {
        setError(friendlyErrorKey(loadError, "explore"));
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as EventRecord[];
      setHasMore(rows.length === PAGE_SIZE);
      setEvents((prev) => (page === 0 ? rows : [...prev, ...rows]));
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, debounced, activeCategory, timeFilter, priceFilter, page]);

  const visible = useMemo(() => {
    let list = events
      .filter((e) => effectiveStatus(e) !== "completed")
      .map((e) => (coords ? { ...e, distance_km: distanceKm(coords.lat, coords.lng, e.latitude, e.longitude) } : e));
    if (coords && maxDistance) list = list.filter((e) => (e.distance_km ?? Infinity) <= maxDistance);
    if (coords && (nearestFirst || maxDistance)) {
      list = [...list].sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
    }
    return list;
  }, [events, coords?.lat, coords?.lng, maxDistance, nearestFirst]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("explore.title")}</h1>
        <p className="mt-1 text-ink/60">{t("explore.subtitle")}</p>
      </div>

      <EventCodeJump />

      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("explore.searchPlaceholder")}
          aria-label={t("explore.searchPlaceholder")}
          className="w-full rounded-full border border-ink/10 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-orange"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Chip
            key={c.id}
            active={activeCategory === c.id}
            onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
          >
            {c.emoji} {td(`category.${c.key}`, c.label)}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-ink/5 pt-4">
        {TIME_FILTERS.map((key) => (
          <Chip key={key} active={timeFilter === key} onClick={() => setTimeFilter(timeFilter === key ? null : key)}>
            {t(`explore.${key}`)}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-ink/10" />
        {PRICE_FILTERS.map((key) => (
          <Chip key={key} active={priceFilter === key} onClick={() => setPriceFilter(priceFilter === key ? null : key)}>
            {t(`explore.${key}`)}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-ink/10" />
        <Chip active={nearestFirst} disabled={!coords} onClick={() => setNearestFirst((v) => !v)}>
          {t("explore.nearby")}
        </Chip>
        {DISTANCE_OPTIONS.map((d) => (
          <Chip
            key={d}
            active={maxDistance === d}
            disabled={!coords}
            onClick={() => setMaxDistance(maxDistance === d ? null : d)}
          >
            {t("explore.within", { km: d })}
          </Chip>
        ))}
      </div>

      {!coords && (
        <div className="space-y-2">
          <p className="text-xs text-ink/50">{t("explore.distanceNeedsLocation")}</p>
          <LocationBar location={location} onManual={() => setDialogOpen(true)} onGps={switchToGps} />
        </div>
      )}

      {error ? (
        <Alert>{t(error)}</Alert>
      ) : loading && events.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink/50">{t("explore.loading")}</p>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink/50">{t("explore.noResults")}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((e) => (
              <ActivityCard key={e.id} event={e} />
            ))}
          </div>
          {hasMore && (
            <div className="text-center">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                className="rounded-full border border-ink/10 bg-white px-6 py-2.5 text-sm font-medium hover:bg-cream-warm disabled:opacity-60"
              >
                {loading ? t("common.loading") : t("explore.loadMore")}
              </button>
            </div>
          )}
        </>
      )}

      {dialogOpen && (
        <ManualLocationDialog
          onClose={() => setDialogOpen(false)}
          onSelect={(area) => {
            setManual(area);
            setDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "border-orange bg-orange text-white" : "border-ink/10 bg-white text-ink/60 hover:bg-cream-warm"
      }`}
    >
      {children}
    </button>
  );
}
