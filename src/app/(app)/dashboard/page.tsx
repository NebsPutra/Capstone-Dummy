import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { DashboardGreeting } from "@/components/DashboardGreeting";
import { NearbyDashboard } from "@/components/NearbyDashboard";
import { HeroBanner } from "@/components/HeroBanner";
import type { ManualArea } from "@/lib/location";

type KeyRow = { key: string } | { key: string }[] | null;
const keyOf = (v: KeyRow) => (Array.isArray(v) ? v[0]?.key : v?.key) ?? null;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { t } = await getServerT();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: interestRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("nickname, full_name, area_lat, area_lng, kelurahan, kecamatan, city, primary_interest:interests(key)")
      .eq("id", user!.id)
      .single(),
    supabase.from("user_interests").select("interest:interests(key)").eq("user_id", user!.id),
  ]);

  const interestKeys = (interestRows ?? [])
    .map((r) => keyOf(r.interest as KeyRow))
    .filter((k): k is string => Boolean(k));
  const primaryKey = keyOf((profile?.primary_interest ?? null) as KeyRow);

  // The registered kelurahan (approximate centroid) is offered as a
  // one-tap fallback when live GPS isn't available.
  const profileArea: ManualArea | null =
    profile?.area_lat != null && profile?.area_lng != null
      ? {
          lat: profile.area_lat,
          lng: profile.area_lng,
          label: [profile.kelurahan, profile.kecamatan, profile.city].filter(Boolean).join(", "),
        }
      : null;

  return (
    <div className="space-y-6">
      <HeroBanner greeting={<DashboardGreeting name={profile?.nickname || profile?.full_name || t("dashboard.there")} />} />
      <NearbyDashboard interestKeys={interestKeys} primaryInterestKey={primaryKey} profileArea={profileArea} />
    </div>
  );
}
