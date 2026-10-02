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

/** Landing: the next few public activities, so visitors see real ones before signing up. */
export function UpcomingActivities() {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useLanguage();
  const [events, setEvents] = useState<EventRecord[] | null>(null);

  useEffect(() => {
    supabase
      .from("events")
      .select(PUBLIC_EVENT_SELECT)
      .eq("privacy", "public")
      .neq("status", "cancelled")
      .gte("event_date", jakartaToday())
      .order("event_date")
      .order("start_time")
      .limit(12)
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as EventRecord[]; // guest-safe subset
        setEvents(rows.filter((e) => effectiveStatus(e) !== "completed").slice(0, 3));
      });
  }, [supabase]);

  // Nothing upcoming (or the request failed): leave the section out entirely.
  if (events?.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 pt-16" aria-labelledby="upcoming-title">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 id="upcoming-title" className="text-2xl font-bold tracking-tight">
          {t("landing.upcomingTitle")}
        </h2>
        <Link href="/explore" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-orange-dark hover:underline">
          {t("landing.seeAll")} <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
      {events === null ? (
        <ActivityGridSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <ActivityCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </section>
  );
}
