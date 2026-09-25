import { createClient } from "@/lib/supabase/server";

export default async function CommunityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("primary_interest_id")
    .eq("id", user!.id)
    .single();

  let people: any[] = [];
  if (me?.primary_interest_id) {
    const { data } = await supabase
      .from("profiles")
      .select("*, primary_interest:interests(*)")
      .eq("primary_interest_id", me.primary_interest_id)
      .neq("id", user!.id)
      .limit(24);
    people = data ?? [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Community</h1>
        <p className="mt-1 text-ink/60">People near you who share your interests.</p>
      </div>

      {people.length === 0 ? (
        <p className="text-sm text-ink/50">
          Set a primary interest on your profile to find people like you.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {people.map((p) => (
            <div key={p.id} className="card p-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange text-lg font-bold text-white">
                {(p.nickname || p.full_name || "U")[0].toUpperCase()}
              </div>
              <p className="mt-2 text-sm font-semibold">{p.nickname || p.full_name}</p>
              <p className="text-xs text-ink/50">
                {p.primary_interest?.emoji} {p.primary_interest?.label}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
