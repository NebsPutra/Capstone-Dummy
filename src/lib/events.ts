import type { EventRecord, EventStatus } from "@/types";
import { eventStamp, jakartaNowStamp, jakartaToday } from "@/lib/utils";

/**
 * The status to show and act on. The stored `status` only tracks capacity
 * (open / almost_full / full) and cancellation; whether an event is
 * ongoing or completed depends on the clock, so it is derived here (the
 * SQL equivalent is `event_phase()`). This prevents contradictions such as
 * a finished event still showing "Open" and accepting participants.
 */
export function effectiveStatus(
  event: Pick<EventRecord, "status" | "event_date" | "start_time" | "end_time">,
  now: string = jakartaNowStamp()
): EventStatus {
  if (event.status === "cancelled") return "cancelled";
  if (now >= eventStamp(event.event_date, event.end_time)) return "completed";
  if (now >= eventStamp(event.event_date, event.start_time)) return "ongoing";
  // Legacy rows may still carry a stored ongoing/completed value.
  if (event.status === "ongoing" || event.status === "completed") return "open";
  return event.status;
}

/** Joins close when the event starts (mirrors join_event()). */
export function isJoinable(status: EventStatus): boolean {
  return status === "open" || status === "almost_full";
}

/** "today" / "tomorrow" for an event date (Asia/Jakarta), otherwise null. */
export function relativeDay(eventDate: string, today: string = jakartaToday()): "today" | "tomorrow" | null {
  if (eventDate === today) return "today";
  // Next calendar day, computed on the date itself (no time zone involved).
  const next = new Date(`${today}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return eventDate === next.toISOString().slice(0, 10) ? "tomorrow" : null;
}

/** Spots left, shown as urgency only when 1–5 remain and joining is still possible. */
export function spotsLeftToShow(
  event: Pick<EventRecord, "max_participants" | "participant_count">,
  status: EventStatus
): number | null {
  const left = event.max_participants - (event.participant_count ?? 0);
  return isJoinable(status) && left > 0 && left <= 5 ? left : null;
}

/** The coming weekend's dates (YYYY-MM-DD): Sat + Sun, or just Sun when today is Sunday. */
export function weekendDates(today: string = jakartaToday()): string[] {
  const d = new Date(`${today}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0) return [today];
  const sat = new Date(d);
  sat.setUTCDate(d.getUTCDate() + (6 - day));
  const sun = new Date(sat);
  sun.setUTCDate(sat.getUTCDate() + 1);
  return [sat.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
}
