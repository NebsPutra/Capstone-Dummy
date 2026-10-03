import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarPlus, Copy, Pencil, Presentation } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { getEventForViewer } from "@/lib/eventAccess";
import { activityWindows, effectiveStatus, isJoinable } from "@/lib/events";
import { formatDate, formatFee, formatTimeRange, jakartaToday } from "@/lib/utils";
import { whatsappDigits } from "@/lib/validation";
import { StatusBadge } from "@/components/StatusBadge";
import { ActivityTags } from "@/components/ActivityTags";
import { JoinPanel } from "@/components/JoinPanel";
import { OwnerPanel, type ParticipantRow } from "@/components/OwnerPanel";
import { ShareBox } from "@/components/ShareBox";
import { EventComments } from "@/components/EventComments";
import { RatingForm } from "@/components/RatingForm";
import { EventMapClient as EventMap } from "@/components/EventMapClient";
import { EventCover } from "@/components/EventCover";
import { FlyerGenerator } from "@/components/FlyerGenerator";
import { ROLE_RANK } from "@/lib/admin";
import { googleCalendarUrl, icsDataUrl } from "@/lib/calendar";
import { SITE_URL } from "@/lib/site";
import { LifeBuoy } from "lucide-react";
import { PUBLIC_EVENT_SELECT, type EventParticipant, type EventRecord } from "@/types";

/** Shared links (WhatsApp, etc.) preview the activity's own title, text and banner. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("title, description, banner_url")
    .eq("id", id)
    .eq("privacy", "public")
    .maybeSingle();
  if (!data) return {};
  const description = data.description?.slice(0, 160) ?? undefined;
  return {
    title: `${data.title} | Komunitas`,
    description,
    openGraph: { title: data.title, description, ...(data.banner_url ? { images: [data.banner_url] } : {}) },
  };
}

export default async function EventDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; created?: string }>;
}) {
  const { id } = await params;
  const { t: token, created } = await searchParams;
  const supabase = await createClient();
  const { t, td, lang } = await getServerT();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged-out visitors get a read-only view of public activities (guest-safe
  // columns only: no organizer contact, share token or participant list).
  const guest = !user;
  let access: { event: EventRecord; viaInvite: boolean } | null;
  if (guest) {
    const { data } = await supabase.from("events").select(PUBLIC_EVENT_SELECT).eq("id", id).maybeSingle();
    if (!data) redirect(`/login?next=${encodeURIComponent(`/activities/${id}${token ? `?t=${token}` : ""}`)}`);
    access = { event: data as unknown as EventRecord, viaInvite: false };
  } else {
    access = await getEventForViewer(supabase, id, token);
  }
  if (!access) notFound();
  const { event, viaInvite } = access;

  // `!!user`: guests have no user and no creator_id column, and undefined === undefined.
  const isOwner = !!user && user.id === event.creator_id;
  const status = effectiveStatus(event);

  // Flyers are for the organizer and for admins (not moderators or attendees).
  let isAdmin = false;
  if (user && !isOwner) {
    const { data: me } = await supabase.from("my_profile").select("role, account_status").eq("id", user.id).maybeSingle();
    isAdmin = me?.account_status === "active" && (ROLE_RANK[me?.role ?? ""] ?? 0) >= ROLE_RANK.admin;
  }
  const canEdit = isOwner && status !== "cancelled" && status !== "completed" && status !== "ongoing";
  const canMakeFlyer = (isOwner || isAdmin) && status !== "cancelled" && status !== "completed";

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
      .select("id, status, joined_at, checked_in_at, participant:profiles!event_participants_user_id_fkey(nickname, username)")
      .eq("event_id", event.id)
      .in("status", ["approved", "pending"])
      .order("joined_at", { ascending: true });
    participants = (data ?? []) as unknown as ParticipantRow[];
  }

  // Group name for "Part of …" (groups are members-only: not for guests).
  const group =
    !guest && event.group_id
      ? ((await supabase.rpc("group_get", { p_group: event.group_id })).data as { id: string; name: string } | null)
      : null;

  // The other dates of a weekly series (each date has its own seats).
  const seriesDates = event.series_id
    ? (
        (
          await supabase
            .from("events")
            .select("id, event_date, start_time")
            .eq("series_id", event.series_id)
            .neq("status", "cancelled")
            .order("event_date")
        ).data ?? []
      ).filter((d) => d.event_date >= jakartaToday() || d.id === event.id)
    : [];

  const windows = activityWindows(event);
  // Who's going: count for everyone, names only for signed-in viewers (privacy rules in SQL).
  const attendees = ((await supabase.rpc("event_attendees", { p_event: event.id })).data ?? null) as {
    count: number;
    people: { username: string; display_name: string; avatar_url: string | null }[];
  } | null;
  // Friends of yours who are going (members only).
  const friendsGoing = guest
    ? null
    : ((await supabase.rpc("friends_going", { p_events: [event.id] })).data as Record<string, { count: number; names: string[] }> | null)?.[
        event.id
      ] ?? null;
  // Waiting list: your place (participants-to-be) or its length (organizer).
  const waitlist = guest
    ? null
    : ((await supabase.rpc("waitlist_status", { p_event_id: event.id })).data as { position: number; length: number } | null);
  // Organizer's average rating, and your own rating of this activity.
  const organizerRating =
    !guest && event.creator_id
      ? ((await supabase.rpc("organizer_rating", { p_user: event.creator_id })).data as { average: number | null; count: number } | null)
      : null;
  const myRating =
    !guest && myParticipation?.status === "approved" && windows.ratingOpen
      ? (await supabase.from("event_ratings").select("rating, comment").eq("event_id", event.id).eq("user_id", user!.id).maybeSingle()).data
      : null;
  const canRate = !guest && !isOwner && myParticipation?.status === "approved" && windows.ratingOpen && status === "completed";

  // RLS on event_contacts returns the number only to the organizer, approved
  // participants, staff, or anyone when the organizer made it public.
  const contact = guest
    ? null
    : (await supabase.from("event_contacts").select("pic_whatsapp").eq("event_id", event.id).maybeSingle()).data;

  return (
    // pb: room for the phone Join bar.
    <div className="mx-auto max-w-3xl space-y-6 pb-20 md:pb-0">
      {/* Right after creating: invite people while the organizer is here. */}
      {isOwner && created && status !== "cancelled" && (
        <section className="card space-y-3 border-2 border-orange/40 p-5">
          <div>
            <h2 className="text-lg font-bold">{t("share.liveTitle")}</h2>
            <p className="text-sm text-ink/70">{t("share.liveBody")}</p>
          </div>
          <ShareBox shareToken={event.share_token} eventCode={event.event_code} title={event.title} />
        </section>
      )}
      {viaInvite && (
        <p className="rounded-xl bg-orange/10 px-4 py-3 text-sm font-medium text-orange-dark">
          {t("event.inviteAccess")}
        </p>
      )}

      <div className="card overflow-hidden">
        <EventCover
          bannerUrl={event.banner_url}
          title={event.title}
          seed={event.id}
          categoryKey={event.category?.key}
          date={event.event_date}
          sizes="(max-width: 768px) 100vw, 768px"
          eager
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
          <ActivityTags event={event} showAllLevels />
          {group && (
            <Link href={`/groups/${group.id}`} className="inline-block text-sm font-semibold text-orange-dark hover:underline">
              {t("groups.partOf", { name: group.name })}
            </Link>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Info label={t("event.date")} value={formatDate(event.event_date, lang)} />
            <Info label={t("event.time")} value={formatTimeRange(event.start_time, event.end_time)} />
            <Info label={t("event.fee")} value={formatFee(event.fee, lang)} />
            <Info
              label={t("event.participants")}
              value={
                <>
                  {event.participant_count ?? 0}/{event.max_participants}
                  {!event.participant_count && isJoinable(status) && (
                    <span className="block text-xs font-medium text-orange-dark">{t("event.beFirst")}</span>
                  )}
                </>
              }
            />
            <Info label={t("event.code")} value={event.event_code} />
            {!guest && (
              <Info
                label={t("event.organizer")}
                value={
                  event.organizer ? (
                    <>
                      <Link href={`/u/${event.organizer.username}`} className="text-orange-dark hover:underline">
                        {event.organizer.nickname || `@${event.organizer.username}`}
                      </Link>
                      {organizerRating?.count ? (
                        <span className="ml-1.5 text-sm font-normal text-ink/70" title={t("rating.organizerTitle")}>
                          ★ {organizerRating.average} ({organizerRating.count})
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )
                }
              />
            )}
          </div>

          {friendsGoing && friendsGoing.count > 0 && (
            <p className="text-sm font-semibold text-orange-dark">
              {t("friends.onPage", {
                names:
                  friendsGoing.names.join(", ") + (friendsGoing.count > friendsGoing.names.length ? ` +${friendsGoing.count - friendsGoing.names.length}` : ""),
              })}
            </p>
          )}

          {attendees && attendees.count > 0 && (
            <AttendeeFaces
              count={attendees.count}
              people={attendees.people}
              label={(() => {
                const [a, b] = attendees.people.map((p) => p.display_name);
                const n = attendees.count;
                if (!a) return t("going.count", { n }); // logged out: number only
                if (n === 1) return t("going.one", { a });
                if (!b) return t("going.oneMore", { a, n: n - 1 });
                if (n === 2) return t("going.two", { a, b });
                return t("going.twoMore", { a, b, n: n - 2 });
              })()}
            />
          )}

          {seriesDates.length > 1 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold">{t("series.otherDates")}</h2>
              <ul className="flex gap-2 overflow-x-auto pb-1">
                {seriesDates.map((d) => (
                  <li key={d.id} className="shrink-0">
                    {d.id === event.id ? (
                      <span
                        aria-current="date"
                        className="block rounded-full bg-orange-deep px-3.5 py-1.5 text-sm font-semibold text-white"
                      >
                        {formatDate(d.event_date, lang)}
                      </span>
                    ) : (
                      <Link
                        href={`/activities/${d.id}`}
                        className="block rounded-full border border-ink/10 bg-surface px-3.5 py-1.5 text-sm font-medium hover:bg-cream-warm"
                      >
                        {formatDate(d.event_date, lang)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(status === "open" || status === "almost_full" || status === "full") && (() => {
            const cal = {
              id: event.id,
              title: event.title,
              description: event.description,
              location: [event.location_name, event.address].filter(Boolean).join(", "),
              date: event.event_date,
              start: event.start_time,
              end: event.end_time,
              url: `${SITE_URL}/activities/${event.id}`,
            };
            return (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <CalendarPlus size={16} className="text-orange-dark" aria-hidden /> {t("calendar.add")}
                </span>
                <a href={googleCalendarUrl(cal)} target="_blank" rel="noreferrer" className="font-medium text-orange-dark hover:underline">
                  Google
                </a>
                <a href={icsDataUrl(cal)} download={`komunitas-${event.event_code}.ics`} className="font-medium text-orange-dark hover:underline">
                  {t("calendar.ics")}
                </a>
              </p>
            );
          })()}

          {event.description && (
            <div>
              <h2 className="mb-1 text-sm font-semibold">{t("event.about")}</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink/70">{event.description}</p>
            </div>
          )}

          <div>
            <h2 className="mb-1 text-sm font-semibold">📍 {t("event.location")}</h2>
            <p className="text-sm text-ink/70">{event.location_name}</p>
            {event.address && <p className="text-sm text-ink/65">{event.address}</p>}
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

          {guest ? (
            <p className="rounded-xl bg-cream-warm p-4 text-sm text-ink/70">{t("guest.contactHidden")}</p>
          ) : (
            <div className="rounded-xl bg-cream-warm p-4">
              <h2 className="mb-1 text-sm font-semibold">{t("event.picTitle")}</h2>
              <p className="text-sm text-ink/70">
                {t("event.pic")}: {event.pic_name}
              </p>
              {contact && (
                <p className="text-sm text-ink/70">
                  {t("event.whatsapp")}:{" "}
                  <a
                    href={`https://wa.me/${whatsappDigits(contact.pic_whatsapp)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-orange-dark"
                  >
                    {contact.pic_whatsapp}
                  </a>
                </p>
              )}
              {event.pic_contact_instructions && (
                <p className="mt-1 text-sm text-ink/70">{event.pic_contact_instructions}</p>
              )}
            </div>
          )}

          {(canEdit || canMakeFlyer || isOwner) && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {isOwner && status !== "cancelled" && status !== "completed" && (
                <Link
                  href={`/present/${event.id}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-dark"
                >
                  <Presentation size={15} /> {t("present.open")}
                </Link>
              )}
              {isOwner && (
                <Link
                  href={`/create?from=${event.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-dark"
                >
                  <Copy size={15} /> {t("event.duplicate")}
                </Link>
              )}
              {canEdit && (
                <Link
                  href={`/activities/${event.id}/edit`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-dark"
                >
                  <Pencil size={15} /> {t("event.edit")}
                </Link>
              )}
              {canMakeFlyer && (
                <FlyerGenerator
                  event={{
                    title: event.title,
                    description: event.description,
                    eventDate: event.event_date,
                    startTime: event.start_time,
                    endTime: event.end_time,
                    locationName: event.location_name,
                    fee: event.fee,
                    maxParticipants: event.max_participants,
                    eventCode: event.event_code,
                    shareToken: event.share_token,
                    bannerUrl: event.banner_url,
                    categoryLabel: event.category ? td(`category.${event.category.key}`, event.category.label) : null,
                    emoji: event.category?.emoji ?? null,
                    id: event.id,
                    categoryKey: event.category?.key ?? null,
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {guest ? (
        <GuestJoinCard
          nextPath={`/activities/${event.id}`}
          title={t("guest.joinTitle")}
          body={t("guest.joinBody")}
          cta={t("guest.joinCta")}
          haveAccount={t("guest.haveAccount")}
          signIn={t("landing.login")}
          fee={formatFee(event.fee, lang)}
          joinable={isJoinable(status)}
        />
      ) : (
        <>
          <JoinPanel
            eventId={event.id}
            inviteToken={viaInvite ? token ?? null : null}
            joinPermission={event.join_permission}
            status={status}
            isOwner={isOwner}
            myParticipation={myParticipation}
            fee={event.fee}
            waitlistPosition={waitlist?.position ?? 0}
          />

          {canRate && <RatingForm eventId={event.id} initial={myRating} />}

          {isOwner && (
            <OwnerPanel
              eventId={event.id}
              status={status}
              maxParticipants={event.max_participants}
              approvedCount={event.participant_count}
              participants={participants}
              attendanceOpen={windows.attendanceOpen && status !== "cancelled"}
              qrOpen={windows.qrOpen && status !== "cancelled"}
              waitlistLength={waitlist?.length ?? 0}
            />
          )}

          <EventComments eventId={event.id} isOwner={isOwner} />

          {!created && <ShareBox shareToken={event.share_token} eventCode={event.event_code} title={event.title} />}

          <Link
            href={`/help?event=${event.id}`}
            className="flex items-center justify-center gap-1.5 text-sm font-medium text-ink/65 hover:text-orange-dark"
          >
            <LifeBuoy size={15} /> {t("help.reportEvent")}
          </Link>
        </>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink/65">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

/** Logged-out visitors: sign up (or in) and come straight back to this activity. */
function GuestJoinCard({
  nextPath,
  title,
  body,
  cta,
  haveAccount,
  signIn,
  fee,
  joinable,
}: {
  nextPath: string;
  title: string;
  body: string;
  cta: string;
  haveAccount: string;
  signIn: string;
  fee: string;
  joinable: boolean;
}) {
  const next = `?next=${encodeURIComponent(nextPath)}`;
  return (
    <div className="card space-y-3 p-6 text-center">
      {/* Phones: pinned "Sign up to join" (guest pages have no bottom nav). */}
      {joinable && (
        <div className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-surface/95 p-2.5 pl-4 text-left shadow-lift backdrop-blur-sm md:hidden">
          <span className="text-sm font-semibold">{fee}</span>
          <Link
            href={`/register${next}`}
            className="rounded-full bg-orange-deep px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-deeper"
          >
            {cta}
          </Link>
        </div>
      )}
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mx-auto max-w-md text-sm text-ink/70">{body}</p>
      <Link
        href={`/register${next}`}
        className="inline-block rounded-full bg-orange-deep px-7 py-3 text-sm font-semibold text-white shadow-soft hover:bg-orange-deeper"
      >
        {cta}
      </Link>
      <p className="text-sm text-ink/70">
        {haveAccount}{" "}
        <Link href={`/login${next}`} className="font-semibold text-orange-dark hover:underline">
          {signIn}
        </Link>
      </p>
    </div>
  );
}

/** "Who's going": overlapping avatars (signed-in viewers) and a short sentence. */
function AttendeeFaces({
  count,
  people,
  label,
}: {
  count: number;
  people: { username: string; display_name: string; avatar_url: string | null }[];
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {people.length > 0 && (
        <div className="flex -space-x-2">
          {people.slice(0, 5).map((p) => (
            <Link
              key={p.username}
              href={`/u/${p.username}`}
              title={p.display_name}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-orange/15 text-xs font-bold text-orange-dark ring-2 ring-surface"
            >
              {p.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                p.display_name.replace(/^@/, "").slice(0, 1).toUpperCase()
              )}
            </Link>
          ))}
          {count > 5 && (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream-warm text-[11px] font-semibold text-ink/70 ring-2 ring-surface">
              +{count - 5}
            </span>
          )}
        </div>
      )}
      <p className="text-sm text-ink/75">{label}</p>
    </div>
  );
}
