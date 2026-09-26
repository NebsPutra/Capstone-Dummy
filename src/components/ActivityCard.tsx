"use client";

import Link from "next/link";
import { Star, Users } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { EventCover } from "./EventCover";
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
      className={`card group block overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-lift active:scale-[0.99] ${
        highlight ? "ring-2 ring-orange/40" : ""
      }`}
    >
      <div className="relative overflow-hidden">
        <EventCover
          bannerUrl={event.banner_url}
          categoryKey={event.category?.key}
          emoji={event.category?.emoji}
          title={event.title}
          className="aspect-[16/7] transition duration-300 group-hover:scale-[1.03]"
        />
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
