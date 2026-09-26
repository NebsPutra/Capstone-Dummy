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
      "role, full_name, nickname, avatar_url, onboarding_completed_at, whatsapp_number, gender, city_id, kecamatan_id, kelurahan_id, bio"
    )
    .eq("id", user.id)
    .maybeSingle();

  // Signed in but registration unfinished (e.g. closed the browser after
  // verifying email): not a full participant yet — resume registration.
  if (onboardingStep(profile) !== "done") {
    redirect("/register?resume=1");
  }

  return (
    <div className="ambient-gradient flex min-h-screen">
      <Sidebar isAdmin={profile?.role === "admin"} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header
          name={profile?.nickname || profile?.full_name}
          avatarUrl={profile?.avatar_url}
        />
        <main className="flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-8">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
