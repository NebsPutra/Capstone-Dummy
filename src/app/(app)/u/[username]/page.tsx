import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Globe, Lock, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/utils";
import { socialLabel, socialUrl, type Relationship, type SocialLink } from "@/lib/social";
import { Avatar, ProfileActions, UserFriendsList } from "@/components/social/People";
import { MessageButton } from "@/components/messages/Messages";

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
  type Messaging = { conversation_id: string | null; reason: string | null };
  const messaging: Messaging | null =
    !p.is_self && p.relationship !== "blocked"
      ? (((await (await createClient()).rpc("can_message_user", { p_user: p.user_id })).data as Messaging | null) ?? null)
      : null;
  const canMessage = Boolean(messaging && (messaging.conversation_id || messaging.reason === null));
  // "How was it?" ratings of activities this person organized (migration 024).
  type Review = { rating: number; comment: string; created_at: string; activity: string; event_id: string };
  const sb = await createClient();
  const [{ data: ratingData }, { data: reviewData }] =
    p.relationship === "blocked"
      ? [{ data: null }, { data: null }]
      : await Promise.all([
          sb.rpc("organizer_rating", { p_user: p.user_id }),
          sb.rpc("organizer_reviews", { p_user: p.user_id }),
        ]);
  const rating = ratingData as { average: number | null; count: number } | null;
  const reviews = (reviewData as Review[] | null) ?? [];
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
            <p className="text-sm text-ink/65">@{p.username}</p>
            {d?.full_name && d.full_name !== p.display_name && <p className="text-sm text-ink/70">{d.full_name}</p>}
            <p className="mt-1 flex items-center gap-1 text-xs text-ink/65">
              <CalendarDays size={13} /> {t("social.memberSince", { date: since })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canMessage && <MessageButton userId={p.user_id} conversationId={messaging?.conversation_id ?? null} />}
            <ProfileActions userId={p.user_id} relationship={p.relationship} acceptsRequests={p.accepts_requests} />
          </div>
        </div>

        {(p.friends_count != null || p.mutual_friends > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink/5 pt-4">
            {p.friends_count != null && <UserFriendsList userId={p.user_id} count={p.friends_count} />}
            {p.mutual_friends > 0 && !p.is_self && <span className="text-sm text-ink/70">{t("social.mutual", { n: p.mutual_friends })}</span>}
          </div>
        )}
      </section>

      {p.relationship === "blocked" ? (
        <section className="card p-6 text-center text-sm text-ink/70">{t("social.youBlocked")}</section>
      ) : !p.can_view || !d ? (
        <section className="card flex flex-col items-center gap-2 p-8 text-center">
          <Lock size={28} className="text-ink/30" />
          <p className="font-semibold">{p.visibility === "friends" ? t("social.friendsOnlyProfile") : t("social.privateProfile")}</p>
          {p.visibility === "friends" && p.relationship === "none" && <p className="text-sm text-ink/65">{t("social.addToSee")}</p>}
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
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/70">
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
                          <span className="max-w-[12rem] truncate text-ink/65">{socialLabel(l)}</span>
                          {p.is_self && l.visibility !== "everyone" && <Lock size={12} className="text-ink/65" aria-label={t(`visibility.${l.visibility}`)} />}
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
                  <p className="text-xs text-ink/65">{t("profile.created")}</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{d.stats.joined}</p>
                  <p className="text-xs text-ink/65">{t("profile.joined")}</p>
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
                            <span className="block truncate text-xs text-ink/65">{e.location}</span>
                          </span>
                          <span className="shrink-0 text-xs text-ink/65">
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

          {rating && rating.count > 0 && (
            <section className="card space-y-3 p-5">
              <h2 className="font-semibold">{t("rating.organizerHeading")}</h2>
              <p className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">★ {rating.average}</span>
                <span className="text-sm text-ink/70">{rating.count === 1 ? t("rating.countOne") : t("rating.count", { n: rating.count })}</span>
              </p>
              {reviews.length > 0 && (
                <ul className="space-y-3 border-t border-ink/5 pt-3">
                  {reviews.map((r, i) => (
                    <li key={i} className="text-sm">
                      <p className="text-orange-dark" aria-label={t("rating.stars", { n: r.rating })}>
                        {"★".repeat(r.rating)}
                        <span className="text-ink/20">{"★".repeat(5 - r.rating)}</span>
                      </p>
                      <p className="mt-0.5 text-ink/80">{r.comment}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink/60">
                        <span>{r.activity}</span>
                        {/* Rude or false review: goes to the admins via Help (category: content). */}
                        <Link href={`/help?event=${r.event_id}&category=content`} className="font-medium hover:text-danger hover:underline">
                          {t("rating.report")}
                        </Link>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
