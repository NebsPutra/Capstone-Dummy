import Link from "next/link";
import { Users } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { formatDate, formatDistance, formatFee, formatTimeRange } from "@/lib/utils";
import type { EventRecord } from "@/types";

export function ActivityCard({ event }: { event: EventRecord }) {
  return (
    <Link
      href={`/activities/${event.id}`}
      className="card block overflow-hidden transition hover:shadow-lg hover:-translate-y-0.5"
    >
      <div className="flex h-28 items-center justify-center bg-cream-warm text-4xl">
        {event.category?.emoji ?? "✨"}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug">{event.title}</h3>
          <StatusBadge status={event.status} />
        </div>
        <p className="text-sm text-ink/60">{event.category?.label}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink/70">
          <span>{formatDate(event.event_date)}</span>
          <span>·</span>
          <span>{formatTimeRange(event.start_time, event.end_time)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-ink/70">
          <span className="truncate">{event.location_name}</span>
          {typeof event.distance_km === "number" && (
            <span className="shrink-0 font-medium text-orange-dark">
              {formatDistance(event.distance_km)}
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
          <span className="text-sm font-medium">{formatFee(event.fee)}</span>
        </div>
      </div>
    </Link>
  );
}
