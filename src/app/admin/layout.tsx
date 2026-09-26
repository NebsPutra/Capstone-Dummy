import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { ROLE_RANK } from "@/lib/admin";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * Server-side gate for the whole admin area. This only decides what to
 * render: every admin query/RPC is independently authorized in the database
 * (role checks + RLS), so a crafted request can't bypass it.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { t } = await getServerT();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase.from("profiles").select("role, account_status").eq("id", user.id).maybeSingle();
  const rank = profile?.account_status === "active" ? ROLE_RANK[profile?.role ?? ""] ?? 0 : 0;
  if (rank < 1) {
    return (
      <main className="ambient-gradient flex min-h-screen items-center justify-center p-6">
        <p className="card p-8 text-center text-sm text-ink/60">{t("admin.forbidden")}</p>
      </main>
    );
  }

  await supabase.rpc("log_admin_action", { p_action: "admin_login", p_meta: null });

  return (
    <AdminShell rank={rank} role={profile!.role}>
      {children}
    </AdminShell>
  );
}
