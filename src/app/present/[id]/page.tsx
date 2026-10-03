import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { SITE_URL } from "@/lib/site";
import { formatDate, formatTimeRange } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { PresentLive } from "@/components/PresentLive";

/**
 * Presenter mode for one activity (organizer only): a big join QR for a
 * projector, with a live "people going" count. Outside the app frame on purpose
 * (no sidebar or nav on screen).
 */
export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/present/${id}`)}`);

  const { data: event } = await supabase
    .from("events")
    .select("id, title, event_date, start_time, end_time, location_name, share_token, event_code, max_participants, creator_id")
    .eq("id", id)
    .maybeSingle();
  if (!event || event.creator_id !== user.id) notFound();

  const { t, lang } = await getServerT();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-cream p-6 text-center md:gap-8">
      <Logo size={40} />
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">{event.title}</h1>
        <p className="mt-2 text-lg text-ink/75 md:text-2xl">
          {formatDate(event.event_date, lang)} · {formatTimeRange(event.start_time, event.end_time)} · {event.location_name}
        </p>
      </div>
      <PresentLive
        eventId={event.id}
        joinUrl={`${SITE_URL}/join/${event.share_token}`}
        max={event.max_participants}
        scanLabel={t("present.scan")}
        goingLabel={t("present.going")}
        codeLabel={t("present.code", { code: event.event_code })}
      />
    </main>
  );
}
