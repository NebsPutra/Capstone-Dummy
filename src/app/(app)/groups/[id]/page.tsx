import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { effectiveStatus } from "@/lib/events";
import { jakartaToday } from "@/lib/utils";
import { ActivityCard } from "@/components/ActivityCard";
import { GroupMembershipButton, type GroupCard } from "@/components/Groups";
import { EVENT_LIST_SELECT, type EventRecord } from "@/types";

type Member = { username: string; display_name: string; avatar_url: string | null; role: "owner" | "member" };

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { t, td } = await getServerT();

  const [{ data: group, error }, { data: events }] = await Promise.all([
    supabase.rpc("group_get", { p_group: id }),
    supabase
      .from("events")
      .select(EVENT_LIST_SELECT)
      .eq("group_id", id)
      .neq("status", "cancelled")
      .gte("event_date", jakartaToday())
      .order("event_date")
      .order("start_time")
      .limit(30),
  ]);
  if (error || !group) notFound();
  const g = group as GroupCard & { members: Member[] };
  const upcoming = ((events ?? []) as EventRecord[]).filter((e) => effectiveStatus(e) !== "completed");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/groups" className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-dark hover:underline">
        <ArrowLeft size={15} aria-hidden /> {t("groups.title")}
      </Link>

      <div className="card space-y-4 p-6">
        <div>
          {g.category && (
            <p className="text-sm font-medium text-orange-dark">
              {g.category.emoji} {td(`category.${g.category.key}`, g.category.label)}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-bold">{g.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink/70">
            <span className="inline-flex items-center gap-1">
              <Users size={14} aria-hidden /> {t("groups.members", { n: g.member_count })}
            </span>
            {g.area && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} aria-hidden /> {g.area}
              </span>
            )}
          </p>
        </div>
        {g.description && <p className="whitespace-pre-line text-sm leading-relaxed text-ink/75">{g.description}</p>}
        <div className="flex flex-wrap items-center gap-3">
          {!g.is_owner && <GroupMembershipButton groupId={g.id} isMember={g.i_am_member} />}
          {g.i_am_member && (
            <Link
              href={`/create?group=${g.id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-orange-deep px-6 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-orange-deeper"
            >
              <Plus size={16} aria-hidden /> {t("groups.createActivity")}
            </Link>
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("groups.upcoming")}</h2>
        {upcoming.length === 0 ? (
          <p className="card px-6 py-8 text-center text-sm text-ink/70">
            {g.i_am_member ? t("groups.noActivitiesMember") : t("groups.noActivities")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {upcoming.map((e) => (
              <ActivityCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("groups.membersTitle")}</h2>
        <ul className="flex flex-wrap gap-2">
          {g.members.map((m) => (
            <li key={m.username}>
              <Link
                href={`/u/${m.username}`}
                className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-surface py-1 pl-1 pr-3 text-sm hover:bg-cream-warm"
              >
                <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-orange/15 text-xs font-bold text-orange-dark">
                  {m.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    m.display_name.slice(0, 1).toUpperCase()
                  )}
                </span>
                {m.display_name}
                {m.role === "owner" && <span className="text-xs text-ink/60">· {t("groups.owner")}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
