import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Globe, Lock, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/utils";
import { socialLabel, socialUrl, type Relationship, type SocialLink } from "@/lib/social";
import { Avatar, ProfileActions, UserFriendsList } from "@/components/social/People";

type Interest = { key: string; label: string; emoji: string | null };
interface PublicProfile {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  member_since: string;
  relationship: Relationship;
  is_self: boolean;
  can_view: boolean;
  visibility: "everyone" | "friends" | "only_me";
  accepts_requests: boolean;
  mutual_friends: number;
  friends_count: number | null;
  details: {
    bio: string | null;
    full_name: string | null;
    city: string | null;
    province: string | null;
    gender: string | null;
    age: number | null;
    primary_interest: Interest | null;
    interests: Interest[];
    stats: { hosted: number; joined: number } | null;
    upcoming: { id: string; title: string; event_date: string; start_time: string; location: string }[] | null;
    links: SocialLink[];
  } | null;
}

async function load(username: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_profile", { p_username: decodeURIComponent(username) });
  if (error) console.error("[komunitas] get_public_profile:", error.message);
  return (data as PublicProfile | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)} · Komunitas` };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const p = await load(username);
  if (!p) notFound();
  const { t, td, lang } = await getServerT();
  const d = p.details;
  const since = new Date(p.member_since).toLocaleDateString(lang === "id" ? "id-ID" : "en-GB", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const facts = d
    ? ([
        d.city ? { icon: <MapPin size={15} />, text: [d.city, d.province].filter(Boolean).join(", ") } : null,
        d.gender ? { icon: null, text: t(`gender.${d.gender}` as "gender.male") } : null,
        d.age != null ? { icon: null, text: t("profile.ageYears", { n: d.age }) } : null,
      ].filter(Boolean) as { icon: React.ReactNode; text: string }[])
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar name={p.display_name} url={p.avatar_url} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{p.display_name}</h1>
            <p className="text-sm text-ink/50">@{p.username}</p>
            {d?.full_name && d.full_name !== p.display_name && <p className="text-sm text-ink/60">{d.full_name}</p>}
            <p className="mt-1 flex items-center gap-1 text-xs text-ink/40">
              <CalendarDays size={13} /> {t("social.memberSince", { date: since })}
            </p>
          </div>
          <ProfileActions userId={p.user_id} relationship={p.relationship} acceptsRequests={p.accepts_requests} />
        </div>

        {(p.friends_count != null || p.mutual_friends > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink/5 pt-4">
            {p.friends_count != null && <UserFriendsList userId={p.user_id} count={p.friends_count} />}
            {p.mutual_friends > 0 && !p.is_self && <span className="text-sm text-ink/60">{t("social.mutual", { n: p.mutual_friends })}</span>}
          </div>
        )}
      </section>

      {p.relationship === "blocked" ? (
        <section className="card p-6 text-center text-sm text-ink/60">{t("social.youBlocked")}</section>
      ) : !p.can_view || !d ? (
        <section className="card flex flex-col items-center gap-2 p-8 text-center">
          <Lock size={28} className="text-ink/30" />
          <p className="font-semibold">{p.visibility === "friends" ? t("social.friendsOnlyProfile") : t("social.privateProfile")}</p>
          {p.visibility === "friends" && p.relationship === "none" && <p className="text-sm text-ink/50">{t("social.addToSee")}</p>}
        </section>
      ) : (
        <>
          {p.is_self && p.visibility !== "everyone" && (
            <p className="rounded-xl bg-cream-warm px-4 py-2.5 text-sm text-ink/70">
              {t("social.selfVisibilityNote", { who: t(`visibility.${p.visibility}`) })}{" "}
              <Link href="/profile/privacy" className="font-semibold text-orange-dark">
                {t("privacy.title")}
              </Link>
            </p>
          )}

          {(d.bio || facts.length > 0 || d.links.length > 0) && (
            <section className="card space-y-3 p-5">
              {d.bio && <p className="whitespace-pre-line text-sm leading-relaxed text-ink/80">{d.bio}</p>}
              {facts.length > 0 && (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/60">
                  {facts.map((f) => (
                    <li key={f.text} className="flex items-center gap-1">
                      {f.icon}
                      {f.text}
                    </li>
                  ))}
                </ul>
              )}
              {d.links.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {d.links.map((l) => {
                    const href = socialUrl(l);
                    if (!href) return null;
                    return (
                      <li key={l.platform}>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer nofollow ugc"
                          className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 px-3 py-1.5 text-sm hover:border-orange"
                        >
                          {l.platform === "website" && <Globe size={14} />}
                          <span className="font-medium">{t(`links.platform.${l.platform}`)}</span>
                          <span className="max-w-[12rem] truncate text-ink/50">{socialLabel(l)}</span>
                          {p.is_self && l.visibility !== "everyone" && <Lock size={12} className="text-ink/40" aria-label={t(`visibility.${l.visibility}`)} />}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {d.interests.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 text-sm font-semibold">{t("social.interests")}</h2>
              <div className="flex flex-wrap gap-2">
                {d.interests.map((i) => (
                  <span
                    key={i.key}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      i.key === d.primary_interest?.key ? "bg-orange/15 text-orange-dark" : "bg-cream-warm text-ink/70"
                    }`}
                  >
                    {i.emoji} {td(`interest.${i.key}`, i.label)}
                  </span>
                ))}
              </div>
            </section>
          )}

          {d.stats && (
            <section className="card p-5">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold">{d.stats.hosted}</p>
                  <p className="text-xs text-ink/50">{t("profile.created")}</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{d.stats.joined}</p>
                  <p className="text-xs text-ink/50">{t("profile.joined")}</p>
                </div>
              </div>
              {d.upcoming && d.upcoming.length > 0 && (
                <div className="mt-4 border-t border-ink/5 pt-4">
                  <h2 className="mb-2 text-sm font-semibold">{t("social.upcomingHosted")}</h2>
                  <ul className="divide-y divide-ink/5">
                    {d.upcoming.map((e) => (
                      <li key={e.id}>
                        <Link href={`/activities/${e.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-orange-dark">
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{e.title}</span>
                            <span className="block truncate text-xs text-ink/50">{e.location}</span>
                          </span>
                          <span className="shrink-0 text-xs text-ink/50">
                            {formatDate(e.event_date, lang)} · {e.start_time.slice(0, 5)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
