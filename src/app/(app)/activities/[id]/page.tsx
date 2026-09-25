import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatFee, formatTimeRange } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { JoinPanel } from "@/components/JoinPanel";
import { ShareBox } from "@/components/ShareBox";
import { EventMapClient as EventMap } from "@/components/EventMapClient";

export default async function EventDetailsPage({
  params,
}: {
  // Next.js 15+ made dynamic route params async
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: event } = await supabase
    .from("events")
    .select("*, category:categories(*), organizer:profiles!events_creator_id_fkey(*)")
    .eq("id", id)
    .single();

  if (!event) notFound();

  const { count: participantCount } = await supabase
    .from("event_participants")
    .select("*", { count: "exact", head: true })
    .eq("event_id", event.id)
    .eq("status", "approved");

  let myParticipation = null;
  if (user) {
    const { data } = await supabase
      .from("event_participants")
      .select("*")
      .eq("event_id", event.id)
      .eq("user_id", user.id)
      .maybeSingle();
    myParticipation = data;
  }

  const isOwner = user?.id === event.creator_id;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="card overflow-hidden">
        <div className="flex h-40 items-center justify-center bg-cream-warm text-6xl">
          {event.category?.emoji ?? "✨"}
        </div>
        <div className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-orange-dark">{event.category?.label}</p>
              <h1 className="mt-1 text-2xl font-bold">{event.title}</h1>
            </div>
            <StatusBadge status={event.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Info label="Date" value={formatDate(event.event_date)} />
            <Info label="Time" value={formatTimeRange(event.start_time, event.end_time)} />
            <Info label="Fee" value={formatFee(event.fee)} />
            <Info
              label="Participants"
              value={`${participantCount ?? 0}/${event.max_participants}`}
            />
            <Info label="Event code" value={event.event_code} />
            <Info
              label="Organizer"
              value={event.organizer?.nickname || event.organizer?.full_name || "—"}
            />
          </div>

          {event.description && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">About this activity</h3>
              <p className="text-sm leading-relaxed text-ink/70">{event.description}</p>
            </div>
          )}

          <div>
            <h3 className="mb-1 text-sm font-semibold">📍 Location</h3>
            <p className="text-sm text-ink/70">{event.location_name}</p>
            {event.address && <p className="text-sm text-ink/50">{event.address}</p>}
            <div className="mt-3">
              <EventMap lat={event.latitude} lng={event.longitude} label={event.location_name} />
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm font-medium text-orange-dark"
            >
              Open in Maps →
            </a>
          </div>

          <div className="rounded-xl bg-cream-warm p-4">
            <h3 className="mb-1 text-sm font-semibold">Organizer / PIC</h3>
            <p className="text-sm text-ink/70">PIC: {event.pic_name}</p>
            {event.whatsapp_public && (
              <p className="text-sm text-ink/70">WhatsApp: {event.pic_whatsapp}</p>
            )}
            {event.pic_contact_instructions && (
              <p className="mt-1 text-sm text-ink/60">{event.pic_contact_instructions}</p>
            )}
          </div>
        </div>
      </div>

      <JoinPanel
        eventId={event.id}
        joinPermission={event.join_permission}
        status={event.status}
        isOwner={isOwner}
        myParticipation={myParticipation}
      />

      <ShareBox
        eventId={event.id}
        shareToken={event.share_token}
        eventCode={event.event_code}
        title={event.title}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink/40">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
