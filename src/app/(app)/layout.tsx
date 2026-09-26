import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { onboardingStep } from "@/lib/onboarding";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Header } from "@/components/Header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "role, full_name, nickname, avatar_url, onboarding_completed_at, whatsapp_number, gender, city_id, kecamatan_id, kelurahan_id, bio, account_status"
    )
    .eq("id", user.id)
    .maybeSingle();

  // Signed in but registration unfinished (e.g. closed the browser after
  // verifying email): not a full participant yet — resume registration.
  if (onboardingStep(profile) !== "done") {
    redirect("/register?resume=1");
  }

  // Suspended/deactivated accounts can only reach Help & Support.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const status = (profile as { account_status?: string } | null)?.account_status;
  if (status && status !== "active" && !pathname.startsWith("/help")) {
    redirect("/account-suspended");
  }

  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  return (
    <div className="ambient-gradient flex min-h-screen">
      <Sidebar isAdmin={["moderator", "admin", "super_admin"].includes(profile?.role ?? "")} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header
          name={profile?.nickname || profile?.full_name}
          avatarUrl={profile?.avatar_url}
          unread={unread ?? 0}
        />
        <main className="flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-8">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
