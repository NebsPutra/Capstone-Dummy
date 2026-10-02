import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { onboardingStep } from "@/lib/onboarding";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Header } from "@/components/Header";
import { LegalFooter } from "@/components/LegalFooter";
import { SkipLink } from "@/components/SkipLink";
import { GuestShell } from "@/components/GuestShell";
import { isGuestPath } from "@/lib/guest";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = (await headers()).get("x-pathname") ?? "";
  if (!user) {
    // Logged-out visitors may browse public activities (read-only).
    if (isGuestPath(pathname)) return <GuestShell pathname={pathname}>{children}</GuestShell>;
    redirect(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
  }

  const { data: profile } = await supabase
    .from("my_profile")
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
  const status = (profile as { account_status?: string } | null)?.account_status;
  if (status && status !== "active" && !pathname.startsWith("/help")) {
    redirect("/account-suspended");
  }

  const [{ count: unread }, { data: unreadMessages }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null).neq("type", "new_message"),
    supabase.rpc("unread_conversation_count"),
  ]);

  const isAdmin = ["moderator", "admin", "super_admin"].includes(profile?.role ?? "");

  return (
    <div className="ambient-gradient flex min-h-screen">
      <SkipLink />
      <Sidebar isAdmin={isAdmin} unreadMessages={(unreadMessages as number | null) ?? 0} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header
          name={profile?.nickname || profile?.full_name}
          avatarUrl={profile?.avatar_url}
          unread={unread ?? 0}
        />
        <main id="main" tabIndex={-1} className="flex-1 px-4 pb-24 pt-5 outline-none md:px-8 md:pb-8">
          {children}
          <LegalFooter className="mt-12" />
        </main>
      </div>
      <MobileNav isAdmin={isAdmin} unreadMessages={(unreadMessages as number | null) ?? 0} />
    </div>
  );
}
