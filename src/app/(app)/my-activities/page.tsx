import { createClient } from "@/lib/supabase/server";
import { ActivityCard } from "@/components/ActivityCard";
import type { EventRecord } from "@/types";

export default async function MyActivitiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: created } = await supabase
    .from("events")
    .select("*, category:categories(*), event_participants(count)")
    .eq("creator_id", user!.id)
    .order("event_date", { ascending: false });

  const { data: joinedRows } = await supabase
    .from("event_participants")
    .select("event:events(*, category:categories(*), event_participants(count))")
    .eq("user_id", user!.id)
    .eq("status", "approved");

  const createdEvents: EventRecord[] = (created ?? []).map((e: any) => ({
    ...e,
    participant_count: e.event_participants?.[0]?.count ?? 0,
  }));

  const joinedEvents: EventRecord[] = (joinedRows ?? [])
    .map((r: any) => r.event)
    .filter(Boolean)
    .map((e: any) => ({
      ...e,
      participant_count: e.event_participants?.[0]?.count ?? 0,
    }));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">My Activities</h1>
        <p className="mt-1 text-ink/60">Activities you&apos;ve created and joined.</p>
      </div>

      <Section title="Created by me" events={createdEvents} empty="You haven't created any activities yet." />
      <Section title="Joined" events={joinedEvents} empty="You haven't joined any activities yet." />
    </div>
  );
}

function Section({
  title,
  events,
  empty,
}: {
  title: string;
  events: EventRecord[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {events.length === 0 ? (
        <p className="text-sm text-ink/50">{empty}</p>
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
