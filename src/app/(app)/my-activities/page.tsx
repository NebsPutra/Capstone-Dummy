import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { ActivityCard } from "@/components/ActivityCard";
import { effectiveStatus } from "@/lib/events";
import { eventStamp } from "@/lib/utils";
import { EVENT_LIST_SELECT, type EventRecord, type ParticipationStatus } from "@/types";

export default async function MyActivitiesPage() {
  const supabase = await createClient();
  const { t } = await getServerT();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: created }, { data: joinedRows }] = await Promise.all([
    supabase
      .from("events")
      .select(EVENT_LIST_SELECT)
      .eq("creator_id", user!.id)
      .order("event_date", { ascending: false }),
    supabase
      .from("event_participants")
      .select(`status, event:events(${EVENT_LIST_SELECT})`)
      .eq("user_id", user!.id)
      .in("status", ["approved", "pending"]),
  ]);

  const rows = (joinedRows ?? []) as unknown as { status: ParticipationStatus; event: EventRecord | null }[];
  const createdList = (created ?? []) as EventRecord[];
  const joinedAll = rows.filter((r) => r.status === "approved" && r.event).map((r) => r.event!);
  const pendingAll = rows.filter((r) => r.status === "pending" && r.event).map((r) => r.event!);

  // Upcoming (incl. happening now) soonest first; finished ones go to a folded
  // "Past" list, newest first, so the next activity is always at the top.
  const stamp = (e: EventRecord) => eventStamp(e.event_date, e.start_time);
  const isPast = (e: EventRecord) => effectiveStatus(e) === "completed";
  const upcoming = (list: EventRecord[]) => list.filter((e) => !isPast(e)).sort((a, b) => stamp(a).localeCompare(stamp(b)));
  const past = [...createdList, ...joinedAll]
    .filter(isPast)
    .sort((a, b) => stamp(b).localeCompare(stamp(a)));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">{t("my.title")}</h1>
        <p className="mt-1 text-ink/70">{t("my.subtitle")}</p>
      </div>

      <Section title={t("my.created")} events={upcoming(createdList)} empty={t("my.emptyCreated")} />
      <Section title={t("my.joined")} events={upcoming(joinedAll)} empty={t("my.emptyJoined")} />
      {upcoming(pendingAll).length > 0 && <Section title={t("my.pending")} events={upcoming(pendingAll)} empty="" />}

      {past.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none text-lg font-semibold [&::-webkit-details-marker]:hidden">
            <span className="mr-2 inline-block transition group-open:rotate-90" aria-hidden>
              ›
            </span>
            {t("my.past", { n: past.length })}
          </summary>
          <div className="activity-grid mt-4">
            {past.map((e) => (
              <ActivityCard key={e.id} event={e} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Section({ title, events, empty }: { title: string; events: EventRecord[]; empty: string }) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {events.length === 0 ? (
        <p className="text-sm text-ink/65">{empty}</p>
      ) : (
        <div className="activity-grid">
          {events.map((e) => (
            <ActivityCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </section>
  );
}
