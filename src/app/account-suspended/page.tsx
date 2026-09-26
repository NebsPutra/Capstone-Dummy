import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { Logo } from "@/components/Logo";

export default async function AccountSuspendedPage() {
  const supabase = await createClient();
  const { t } = await getServerT();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("account_status, status_reason").eq("id", user.id).maybeSingle();
  if (!profile || profile.account_status === "active") redirect("/dashboard");

  return (
    <main className="ambient-gradient flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <Logo className="justify-center" />
        <div className="card animate-pop-in space-y-4 p-8">
          <ShieldAlert size={40} className="mx-auto text-orange-dark" />
          <h1 className="text-xl font-bold">
            {profile.account_status === "suspended" ? t("suspended.title") : t("suspended.deactivated")}
          </h1>
          <p className="text-sm text-ink/60">{t("suspended.desc")}</p>
          {profile.status_reason && (
            <p className="rounded-xl bg-cream-warm px-4 py-2 text-sm">{t("suspended.reason", { reason: profile.status_reason })}</p>
          )}
          <div className="flex flex-col gap-2 pt-2">
            <Link href="/help?category=account" className="rounded-full bg-orange py-3 text-sm font-semibold text-white hover:bg-orange-deep">
              {t("suspended.contact")}
            </Link>
            <Link href="/settings" className="text-sm font-medium text-ink/60">
              {t("settings.logout")}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
