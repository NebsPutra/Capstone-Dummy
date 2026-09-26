import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { ActivityCard } from "@/components/ActivityCard";
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
  const joined = rows.filter((r) => r.status === "approved" && r.event).map((r) => r.event!);
  const pending = rows.filter((r) => r.status === "pending" && r.event).map((r) => r.event!);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">{t("my.title")}</h1>
        <p className="mt-1 text-ink/60">{t("my.subtitle")}</p>
      </div>

      <Section title={t("my.created")} events={(created ?? []) as EventRecord[]} empty={t("my.emptyCreated")} />
      <Section title={t("my.joined")} events={joined} empty={t("my.emptyJoined")} />
      {pending.length > 0 && <Section title={t("my.pending")} events={pending} empty="" />}
    </div>
  );
}

function Section({ title, events, empty }: { title: string; events: EventRecord[]; empty: string }) {
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
