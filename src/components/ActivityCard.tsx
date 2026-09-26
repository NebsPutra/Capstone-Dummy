"use client";

import Link from "next/link";
import { Star, Users } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { formatDate, formatDistance, formatFee, formatTimeRange } from "@/lib/utils";
import { effectiveStatus } from "@/lib/events";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { EventRecord } from "@/types";

export function ActivityCard({
  event,
  highlight,
}: {
  event: EventRecord;
  /** Shown for recommendations that match the user's primary interest. */
  highlight?: string;
}) {
  const { lang, td } = useLanguage();
  const status = effectiveStatus(event);

  return (
    <Link
      href={`/activities/${event.id}`}
      className={`card block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg ${
        highlight ? "ring-2 ring-orange/40" : ""
      }`}
    >
      <div className="relative flex h-28 items-center justify-center bg-cream-warm text-4xl">
        {event.category?.emoji ?? "✨"}
        {highlight && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-orange px-2.5 py-1 text-xs font-semibold text-white">
            <Star size={12} /> {highlight}
          </span>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug">{event.title}</h3>
          <StatusBadge status={status} />
        </div>
        {event.category && (
          <p className="text-sm text-ink/60">
            {td(`category.${event.category.key}`, event.category.label)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink/70">
          <span>{formatDate(event.event_date, lang)}</span>
          <span>·</span>
          <span>{formatTimeRange(event.start_time, event.end_time)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-sm text-ink/70">
          <span className="truncate">{event.location_name}</span>
          {typeof event.distance_km === "number" && (
            <span className="shrink-0 font-medium text-orange-dark">
              {formatDistance(event.distance_km, lang)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-sm text-ink/60">
            <Users size={15} />
            <span>
              {event.participant_count ?? 0}/{event.max_participants}
            </span>
          </div>
          <span className="text-sm font-medium">{formatFee(event.fee, lang)}</span>
        </div>
      </div>
    </Link>
  );
}
