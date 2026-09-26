import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import type { Interest } from "@/types";

interface Person {
  id: string;
  nickname: string | null;
  full_name: string | null;
  city: string | null;
  primary_interest: Interest | null;
}

export default async function CommunityPage() {
  const supabase = await createClient();
  const { t, td } = await getServerT();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("primary_interest_id")
    .eq("id", user!.id)
    .single();

  let people: Person[] = [];
  if (me?.primary_interest_id) {
    const { data } = await supabase
      .from("profiles")
      .select("id, nickname, full_name, city, primary_interest:interests(*)")
      .eq("primary_interest_id", me.primary_interest_id)
      .not("onboarding_completed_at", "is", null)
      .neq("id", user!.id)
      .limit(24);
    people = (data ?? []) as unknown as Person[];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("community.title")}</h1>
        <p className="mt-1 text-ink/60">{t("community.subtitle")}</p>
      </div>

      {!me?.primary_interest_id ? (
        <p className="text-sm text-ink/50">{t("community.noPrimary")}</p>
      ) : people.length === 0 ? (
        <p className="text-sm text-ink/50">{t("community.empty")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {people.map((p) => (
            <div key={p.id} className="card p-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange text-lg font-bold text-white">
                {(p.nickname || p.full_name || "U")[0].toUpperCase()}
              </div>
              <p className="mt-2 truncate text-sm font-semibold">{p.nickname || p.full_name}</p>
              {p.primary_interest && (
                <p className="text-xs text-ink/50">
                  {p.primary_interest.emoji} {td(`interest.${p.primary_interest.key}`, p.primary_interest.label)}
                </p>
              )}
              {p.city && <p className="mt-0.5 truncate text-xs text-ink/40">{p.city}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
