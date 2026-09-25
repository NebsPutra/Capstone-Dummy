"use client";

import { useEffect, useState } from "react";
import { Search, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ActivityCard } from "@/components/ActivityCard";
import { distanceKm } from "@/lib/utils";
import type { Category, EventRecord } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const TIME_FILTER_KEYS = ["nearby", "today", "tomorrow", "thisWeek", "upcoming", "ongoing"];
const PRICE_FILTER_KEYS = ["free", "paid"];
const DISTANCE_OPTIONS = [1, 3, 5, 10];

export default function ExplorePage() {
  const supabase = createClient();
  const { t } = useLanguage();

  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<string | null>(null);
  const [priceFilter, setPriceFilter] = useState<string | null>(null);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [manualArea, setManualArea] = useState("");

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .then(({ data }) => setCategories(data ?? []));
  }, [supabase]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationDenied(true)
    );
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let q = supabase
        .from("events")
        .select("*, category:categories(*), event_participants(count)")
        .eq("privacy", "public")
        .order("event_date", { ascending: true });

      if (query) q = q.ilike("title", `%${query}%`);
      if (activeCategory) q = q.eq("category_id", activeCategory);

      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      if (timeFilter === "today") q = q.eq("event_date", todayStr);
      if (timeFilter === "tomorrow") {
        const t = new Date(today);
        t.setDate(t.getDate() + 1);
        q = q.eq("event_date", t.toISOString().slice(0, 10));
      }
      if (timeFilter === "thisWeek") {
        const end = new Date(today);
        end.setDate(end.getDate() + 7);
        q = q.gte("event_date", todayStr).lte("event_date", end.toISOString().slice(0, 10));
      }
      if (timeFilter === "upcoming") q = q.gte("event_date", todayStr).eq("status", "open");
      if (timeFilter === "ongoing") q = q.eq("status", "ongoing");

      if (priceFilter === "free") q = q.eq("fee", 0);
      if (priceFilter === "paid") q = q.gt("fee", 0);

      const { data } = await q.limit(60);
      let list: EventRecord[] = (data ?? []).map((e: any) => ({
        ...e,
        participant_count: e.event_participants?.[0]?.count ?? 0,
      }));

      if (coords) {
        list = list
          .map((e) => ({
            ...e,
            distance_km: distanceKm(coords.lat, coords.lng, e.latitude, e.longitude),
          }))
          .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
      }

      if (maxDistance && coords) {
        list = list.filter((e) => (e.distance_km ?? Infinity) <= maxDistance);
      }

      setEvents(list);
      setLoading(false);
    }
    load();
  }, [supabase, query, activeCategory, timeFilter, priceFilter, maxDistance, coords]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("explore.title")}</h1>
        <p className="mt-1 text-ink/60">{t("explore.subtitle")}</p>
      </div>

      {locationDenied && (
        <div className="card flex items-start gap-3 p-4 text-sm">
          <MapPin size={18} className="mt-0.5 shrink-0 text-orange-dark" />
          <div className="flex-1">
            <p className="text-ink/70">{t("explore.locationUnavailable")}</p>
            <input
              value={manualArea}
              onChange={(e) => setManualArea(e.target.value)}
              placeholder={t("explore.manualAreaPlaceholder")}
              className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-orange"
            />
          </div>
        </div>
      )}

      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("explore.searchPlaceholder")}
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
            {c.emoji} {c.label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-ink/5 pt-4">
        {TIME_FILTER_KEYS.map((key) => (
          <Chip
            key={key}
            active={timeFilter === key}
            onClick={() => setTimeFilter(timeFilter === key ? null : key)}
          >
            {t(`explore.${key}`)}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-ink/10" />
        {PRICE_FILTER_KEYS.map((key) => (
          <Chip
            key={key}
            active={priceFilter === key}
            onClick={() => setPriceFilter(priceFilter === key ? null : key)}
          >
            {t(`explore.${key}`)}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-ink/10" />
        {DISTANCE_OPTIONS.map((d) => (
          <Chip key={d} active={maxDistance === d} onClick={() => setMaxDistance(maxDistance === d ? null : d)}>
            {d} km
          </Chip>
        ))}
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-ink/50">{t("explore.loading")}</p>
      ) : events.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink/50">{t("explore.noResults")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <ActivityCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "border-orange bg-orange text-white"
          : "border-ink/10 bg-white text-ink/60 hover:bg-cream-warm"
      }`}
    >
      {children}
    </button>
  );
}
