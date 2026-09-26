import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { RequestActions } from "@/components/RequestActions";
import { NotificationFeed, type NotificationRow } from "@/components/NotificationFeed";
import type { ParticipationStatus } from "@/types";

interface IncomingRow {
  id: string;
  event: { id: string; title: string };
  participant: { nickname: string | null; full_name: string | null } | null;
}
interface MineRow {
  id: string;
  status: ParticipationStatus;
  event: { id: string; title: string } | null;
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { t } = await getServerT();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: feed }, { data: incoming }, { data: mine }] = await Promise.all([
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
    // Pending join requests on activities I organize
    supabase
      .from("event_participants")
      .select(
        "id, event:events!inner(id, title, creator_id), participant:profiles!event_participants_user_id_fkey(nickname, full_name)"
      )
      .eq("status", "pending")
      .eq("event.creator_id", user!.id)
      .order("joined_at", { ascending: false }),
    // My own requests on approval-only activities
    supabase
      .from("event_participants")
      .select("id, status, event:events!inner(id, title, join_permission)")
      .eq("user_id", user!.id)
      .eq("event.join_permission", "approval_required")
      .order("joined_at", { ascending: false })
      .limit(20),
  ]);

  const incomingRows = (incoming ?? []) as unknown as IncomingRow[];
  const mineRows = ((mine ?? []) as unknown as MineRow[]).filter((r) => r.event);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("notif.title")}</h1>
        <p className="mt-1 text-ink/60">{t("notif.subtitle")}</p>
      </div>

      <NotificationFeed items={(feed ?? []) as NotificationRow[]} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("notif.incoming")}</h2>
        {incomingRows.length === 0 ? (
          <p className="text-sm text-ink/50">{t("notif.caughtUp")}</p>
        ) : (
          incomingRows.map((p) => (
            <div key={p.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p>
                  {t("notif.requested", {
                    name: p.participant?.nickname || p.participant?.full_name || t("event.someone"),
                    title: p.event.title,
                  })}
                </p>
                <Link href={`/activities/${p.event.id}`} className="text-xs font-medium text-orange-dark">
                  {t("notif.review")}
                </Link>
              </div>
              <RequestActions participantId={p.id} />
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("notif.mine")}</h2>
        {mineRows.length === 0 ? (
          <p className="text-sm text-ink/50">{t("notif.noRequests")}</p>
        ) : (
          mineRows.map((r) => (
            <Link
              key={r.id}
              href={`/activities/${r.event!.id}`}
              className="card flex items-center justify-between gap-3 p-4 text-sm hover:shadow-lg"
            >
              <span className="truncate font-medium">{r.event!.title}</span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  r.status === "approved"
                    ? "bg-green-50 text-green-700"
                    : r.status === "pending"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-stone-100 text-stone-500"
                }`}
              >
                {t(`participation.${r.status}`)}
              </span>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
