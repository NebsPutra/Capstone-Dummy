import type { EventRecord, EventStatus } from "@/types";
import { eventStamp, jakartaNowStamp } from "@/lib/utils";

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
