import { createClient } from "@/lib/supabase/server";
import { SecurityCenter, type SecurityEventRow } from "@/components/SecurityCenter";

export default async function SecurityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: events }] = await Promise.all([
    supabase.from("my_profile").select("pin_set_at").eq("id", user!.id).single(),
    supabase
      .from("security_events")
      .select("id, type, device, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <SecurityCenter
      email={user!.email ?? ""}
      pinSetAt={(profile as { pin_set_at?: string | null } | null)?.pin_set_at ?? null}
      events={(events ?? []) as SecurityEventRow[]}
    />
  );
}
