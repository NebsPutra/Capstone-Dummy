import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { getEventForViewer } from "@/lib/eventAccess";
import { effectiveStatus } from "@/lib/events";
import { formatDate, formatFee, formatTimeRange } from "@/lib/utils";
import { whatsappDigits } from "@/lib/validation";
import { StatusBadge } from "@/components/StatusBadge";
import { JoinPanel } from "@/components/JoinPanel";
import { OwnerPanel, type ParticipantRow } from "@/components/OwnerPanel";
import { ShareBox } from "@/components/ShareBox";
import { EventMapClient as EventMap } from "@/components/EventMapClient";
import { EventCover } from "@/components/EventCover";
import { LifeBuoy } from "lucide-react";
import type { EventParticipant } from "@/types";

export default async function EventDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t: token } = await searchParams;
  const supabase = await createClient();
  const { t, td, lang } = await getServerT();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await getEventForViewer(supabase, id, token);
  if (!access) notFound();
  const { event, viaInvite } = access;

  const isOwner = user?.id === event.creator_id;
  const status = effectiveStatus(event);

  let myParticipation: EventParticipant | null = null;
  if (user && !isOwner) {
    const { data } = await supabase
      .from("event_participants")
      .select("*")
      .eq("event_id", event.id)
      .eq("user_id", user.id)
      .maybeSingle();
    myParticipation = data;
  }

  let participants: ParticipantRow[] = [];
  if (isOwner) {
    const { data } = await supabase
      .from("event_participants")
      .select("id, status, joined_at, participant:profiles!event_participants_user_id_fkey(nickname, full_name)")
      .eq("event_id", event.id)
      .in("status", ["approved", "pending"])
      .order("joined_at", { ascending: true });
    participants = (data ?? []) as unknown as ParticipantRow[];
  }

  const showWhatsapp = event.whatsapp_public || isOwner || myParticipation?.status === "approved";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {viaInvite && (
        <p className="rounded-xl bg-orange/10 px-4 py-3 text-sm font-medium text-orange-dark">
          {t("event.inviteAccess")}
        </p>
      )}

      <div className="card overflow-hidden">
        <EventCover
          bannerUrl={event.banner_url}
          categoryKey={event.category?.key}
          emoji={event.category?.emoji}
          title={event.title}
          className="aspect-video max-h-80"
        />
        <div className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-orange-dark">
                {event.category ? td(`category.${event.category.key}`, event.category.label) : null}
                {event.privacy === "private" && ` · ${t("privacy.private")}`}
              </p>
              <h1 className="mt-1 text-2xl font-bold">{event.title}</h1>
            </div>
            <StatusBadge status={status} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Info label={t("event.date")} value={formatDate(event.event_date, lang)} />
            <Info label={t("event.time")} value={formatTimeRange(event.start_time, event.end_time)} />
            <Info label={t("event.fee")} value={formatFee(event.fee, lang)} />
            <Info label={t("event.participants")} value={`${event.participant_count ?? 0}/${event.max_participants}`} />
            <Info label={t("event.code")} value={event.event_code} />
            <Info
              label={t("event.organizer")}
              value={event.organizer?.nickname || event.organizer?.full_name || "—"}
            />
          </div>

          {event.description && (
            <div>
              <h2 className="mb-1 text-sm font-semibold">{t("event.about")}</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink/70">{event.description}</p>
            </div>
          )}

          <div>
            <h2 className="mb-1 text-sm font-semibold">📍 {t("event.location")}</h2>
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
              {t("event.openInMaps")}
            </a>
          </div>

          <div className="rounded-xl bg-cream-warm p-4">
            <h2 className="mb-1 text-sm font-semibold">{t("event.picTitle")}</h2>
            <p className="text-sm text-ink/70">
              {t("event.pic")}: {event.pic_name}
            </p>
            {showWhatsapp && (
              <p className="text-sm text-ink/70">
                {t("event.whatsapp")}:{" "}
                <a
                  href={`https://wa.me/${whatsappDigits(event.pic_whatsapp)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-orange-dark"
                >
                  {event.pic_whatsapp}
                </a>
              </p>
            )}
            {event.pic_contact_instructions && (
              <p className="mt-1 text-sm text-ink/60">{event.pic_contact_instructions}</p>
            )}
          </div>

          {isOwner && status !== "cancelled" && status !== "completed" && status !== "ongoing" && (
            <Link
              href={`/activities/${event.id}/edit`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-dark"
            >
              <Pencil size={15} /> {t("event.edit")}
            </Link>
          )}
        </div>
      </div>

      <JoinPanel
        eventId={event.id}
        inviteToken={viaInvite ? token ?? null : null}
        joinPermission={event.join_permission}
        status={status}
        isOwner={isOwner}
        myParticipation={myParticipation}
      />

      {isOwner && (
        <OwnerPanel
          eventId={event.id}
          status={status}
          maxParticipants={event.max_participants}
          approvedCount={event.participant_count}
          participants={participants}
        />
      )}

      <ShareBox shareToken={event.share_token} eventCode={event.event_code} title={event.title} />

      <Link
        href={`/help?event=${event.id}`}
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-ink/50 hover:text-orange-dark"
      >
        <LifeBuoy size={15} /> {t("help.reportEvent")}
      </Link>
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
