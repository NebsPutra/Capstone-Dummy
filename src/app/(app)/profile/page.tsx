import { createClient } from "@/lib/supabase/server";
import { ProfileEditor } from "@/components/ProfileEditor";
import { ProfileStatLabel } from "@/components/ProfileStatLabel";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, primary_interest:interests(*)")
    .eq("id", user!.id)
    .single();

  const { data: userInterests } = await supabase
    .from("user_interests")
    .select("interest:interests(*)")
    .eq("user_id", user!.id);

  const { count: createdCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("creator_id", user!.id);

  const { count: joinedCount } = await supabase
    .from("event_participants")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .eq("status", "approved");

  const { data: allInterests } = await supabase.from("interests").select("*");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange text-2xl font-bold text-white">
            {(profile?.nickname || profile?.full_name || "U")[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold">
              {profile?.nickname || profile?.full_name}
            </h1>
            <p className="text-sm text-ink/50">@{profile?.username}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-y border-ink/5 py-4 text-center">
          <div>
            <p className="text-lg font-bold">{createdCount ?? 0}</p>
            <ProfileStatLabel translationKey="profile.created" />
          </div>
          <div>
            <p className="text-lg font-bold">{joinedCount ?? 0}</p>
            <ProfileStatLabel translationKey="profile.joined" />
          </div>
          <div>
            <p className="text-lg font-bold">
              {profile?.primary_interest?.emoji ?? "—"}
            </p>
            <p className="text-xs text-ink/50">
              {profile?.primary_interest?.label ?? "No primary interest"}
            </p>
          </div>
        </div>

        {profile?.bio && <p className="mt-4 text-sm text-ink/70">{profile.bio}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {(userInterests ?? []).map((ui: any) => (
            <span
              key={ui.interest.id}
              className="rounded-full bg-cream-warm px-3 py-1 text-xs font-medium text-ink/70"
            >
              {ui.interest.emoji} {ui.interest.label}
            </span>
          ))}
        </div>
      </div>

      <ProfileEditor profile={profile} allInterests={allInterests ?? []} />
    </div>
  );
}
