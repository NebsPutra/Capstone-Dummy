import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { ProfileEditor } from "@/components/ProfileEditor";
import { SocialLinksEditor, UsernameCard } from "@/components/social/ProfileSettings";
import type { Interest, Profile } from "@/types";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { t, td } = await getServerT();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: userInterests }, { count: createdCount }, { count: joinedCount }, { data: allInterests }, { count: friendCount }] =
    await Promise.all([
      supabase.from("my_profile").select("*").eq("id", user!.id).single(),
      supabase.from("user_interests").select("interest_id").eq("user_id", user!.id),
      supabase.from("events").select("id", { count: "exact", head: true }).eq("creator_id", user!.id),
      supabase
        .from("event_participants")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("status", "approved"),
      supabase.from("interests").select("*"),
      supabase.from("friendships").select("id", { count: "exact", head: true }).eq("status", "accepted"),
    ]);

  const interests = (allInterests ?? []) as Interest[];
  const selectedIds = (userInterests ?? []).map((r: { interest_id: string }) => r.interest_id);
  const p = profile as Profile | null;
  const primary = interests.find((i) => i.id === p?.primary_interest_id);
  const area = [p?.kelurahan, p?.kecamatan, p?.city].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-orange-deep text-2xl font-bold text-white">
            {(p?.nickname || p?.full_name || "U")[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{p?.nickname || p?.full_name}</h1>
            <p className="text-sm text-ink/65">
              @{p?.username}
              {p?.gender && ` · ${t(`gender.${p.gender}`)}`}
            </p>
            {area && <p className="text-sm text-ink/65">📍 {area}</p>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-y border-ink/5 py-4 text-center">
          <div>
            <p className="text-lg font-bold">{createdCount ?? 0}</p>
            <p className="text-xs text-ink/65">{t("profile.created")}</p>
          </div>
          <div>
            <p className="text-lg font-bold">{joinedCount ?? 0}</p>
            <p className="text-xs text-ink/65">{t("profile.joined")}</p>
          </div>
          <div>
            <p className="text-lg font-bold">{primary?.emoji ?? "—"}</p>
            <p className="text-xs text-ink/65">
              {primary ? td(`interest.${primary.key}`, primary.label) : t("profile.noPrimary")}
            </p>
          </div>
        </div>

        {p?.bio && <p className="mt-4 text-sm text-ink/70">{p.bio}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {interests
            .filter((i) => selectedIds.includes(i.id))
            .map((i) => (
              <span
                key={i.id}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  i.id === primary?.id ? "bg-orange/15 text-orange-dark" : "bg-cream-warm text-ink/70"
                }`}
              >
                {i.emoji} {td(`interest.${i.key}`, i.label)}
              </span>
            ))}
        </div>
      </div>

      <a href="/profile/security" className="card flex items-center justify-between gap-3 p-5 transition hover:border-orange/40">
        <div className="min-w-0">
          <p className="font-semibold">🔒 {t("security.title")}</p>
          <p className={`text-sm ${p?.pin_set_at ? "text-ink/65" : "font-medium text-orange-dark"}`}>
            {p?.pin_set_at ? t("security.cardDesc") : t("security.cardNoPin")}
          </p>
        </div>
        <span className="text-ink/65">→</span>
      </a>

      <div className="grid gap-4 sm:grid-cols-2">
        <a href="/profile/privacy" className="card flex items-center justify-between gap-3 p-5 transition hover:border-orange/40">
          <div className="min-w-0">
            <p className="font-semibold">👁️ {t("privacy.title")}</p>
            <p className="text-sm text-ink/65">{t("privacy.cardDesc")}</p>
          </div>
          <span className="text-ink/65">→</span>
        </a>
        <a href="/community?tab=friends" className="card flex items-center justify-between gap-3 p-5 transition hover:border-orange/40">
          <div className="min-w-0">
            <p className="font-semibold">🤝 {t("social.tab.friends")}</p>
            <p className="text-sm text-ink/65">{t("social.friendsCount", { n: friendCount ?? 0 })}</p>
          </div>
          <span className="text-ink/65">→</span>
        </a>
      </div>

      {p && <UsernameCard username={p.username} />}

      {p && (
        <ProfileEditor
          profile={p}
          allInterests={interests.filter((i) => (i as Interest & { is_active?: boolean }).is_active !== false || selectedIds.includes(i.id))}
          selectedInterestIds={selectedIds}
        />
      )}

      {p && <SocialLinksEditor userId={p.id} />}

      <Link href="/help" className="block text-center text-sm font-medium text-ink/65 hover:text-orange-dark">
        {t("help.needHelp")} {t("help.report")} →
      </Link>
    </div>
  );
}
