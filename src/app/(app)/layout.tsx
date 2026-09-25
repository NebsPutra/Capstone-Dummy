import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    .select("full_name, nickname, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <div className="ambient-gradient flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
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
