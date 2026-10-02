"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ActivityCard } from "@/components/ActivityCard";
import { ActivityGridSkeleton } from "@/components/Skeletons";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { effectiveStatus } from "@/lib/events";
import { jakartaToday } from "@/lib/utils";
import { PUBLIC_EVENT_SELECT, type EventRecord } from "@/types";

const PAGE = 9;

/**
 * Landing: every upcoming public activity, at any distance (no location
 * needed), soonest first, so visitors see real ones before signing up.
 * Shows 9 at a time. Private, finished and cancelled activities are left out.
 */
export function UpcomingActivities() {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useLanguage();
  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    supabase
      .from("events")
      .select(PUBLIC_EVENT_SELECT)
      .eq("privacy", "public")
      .neq("status", "cancelled")
      .gte("event_date", jakartaToday())
      .order("event_date")
      .order("start_time")
      .limit(500)
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as EventRecord[]; // guest-safe subset
        setEvents(rows.filter((e) => effectiveStatus(e) !== "completed"));
      });
  }, [supabase]);

  // Nothing upcoming (or the request failed): leave the section out entirely.
  if (events?.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 pt-16" aria-labelledby="upcoming-title">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 id="upcoming-title" className="text-2xl font-bold tracking-tight">
            {t("landing.upcomingTitle")}
          </h2>
          {events && <p className="mt-1 text-sm text-ink/70">{events.length === 1 ? t("landing.upcomingCountOne") : t("landing.upcomingCount", { n: events.length })}</p>}
        </div>
        <Link href="/explore" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-orange-dark hover:underline">
          {t("landing.seeAll")} <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
      {events === null ? (
        <ActivityGridSkeleton count={3} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, shown).map((e) => (
              <ActivityCard key={e.id} event={e} />
            ))}
          </div>
          {events.length > shown && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="rounded-full border border-ink/10 bg-surface px-6 py-2.5 text-sm font-semibold hover:bg-cream-warm"
              >
                {t("landing.showMore", { n: events.length - shown })}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
