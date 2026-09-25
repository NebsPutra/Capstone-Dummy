import { createClient } from "@/lib/supabase/server";
import { ActivityCard } from "@/components/ActivityCard";
import { distanceKm } from "@/lib/utils";
import type { EventRecord } from "@/types";
import { DashboardGreeting, SectionTitle } from "@/components/DashboardGreeting";

async function getSection(
  supabase: ReturnType<typeof createClient>,
  filter: (q: any) => any
) {
  let query = supabase
    .from("events")
    .select("*, category:categories(*), event_participants(count)")
    .eq("privacy", "public")
    .order("event_date", { ascending: true })
    .limit(6);
  query = filter(query);
  const { data } = await query;
  return (data ?? []).map((e: any) => ({
    ...e,
    participant_count: e.event_participants?.[0]?.count ?? 0,
  })) as EventRecord[];
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, primary_interest:interests(*)")
    .eq("id", user!.id)
    .single();

  const today = new Date().toISOString().slice(0, 10);

  const [nearby, upcoming, ongoing] = await Promise.all([
    getSection(supabase, (q) => q.gte("event_date", today)),
    getSection(supabase, (q) => q.eq("status", "open").gte("event_date", today)),
    getSection(supabase, (q) => q.eq("status", "ongoing")),
  ]);

  let recommended: EventRecord[] = [];
  if (profile?.primary_interest_id) {
    const { data: catMatch } = await supabase
      .from("events")
      .select("*, category:categories(*), event_participants(count)")
      .eq("privacy", "public")
      .gte("event_date", today)
      .limit(6);
    recommended = (catMatch ?? []).map((e: any) => ({
      ...e,
      participant_count: e.event_participants?.[0]?.count ?? 0,
    }));
  }

  // If the user has a stored last-known location, annotate distances
  const withDistance = (list: EventRecord[]) =>
    profile?.last_lat && profile?.last_lng
      ? list.map((e) => ({
          ...e,
          distance_km: distanceKm(profile.last_lat, profile.last_lng, e.latitude, e.longitude),
        }))
      : list;

  const greetName = profile?.nickname || profile?.full_name || "there";

  return (
    <div className="space-y-10">
      <DashboardGreeting name={greetName} />

      <Section translationKey="dashboard.nearby" events={withDistance(nearby)} />
      <Section translationKey="dashboard.upcoming" events={upcoming} />
      {ongoing.length > 0 && <Section translationKey="dashboard.ongoing" events={ongoing} />}
      {recommended.length > 0 && (
        <Section translationKey="dashboard.recommended" events={withDistance(recommended)} />
      )}
    </div>
  );
}

function Section({
  translationKey,
  events,
}: {
  translationKey: string;
  events: EventRecord[];
}) {
  if (events.length === 0) return null;
  return (
    <section>
      <SectionTitle translationKey={translationKey} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <ActivityCard key={e.id} event={e} />
        ))}
      </div>
    </section>
  );
}
