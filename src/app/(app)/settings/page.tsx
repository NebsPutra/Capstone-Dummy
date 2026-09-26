"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useUserLocation } from "@/lib/location";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LocationBar } from "@/components/NearbyDashboard";
import { ManualLocationDialog } from "@/components/ManualLocationDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();
  const { location, setManual, switchToGps } = useUserLocation({ autoPrompt: false });
  const [email, setEmail] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

      <div className="card flex items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-semibold">{t("settings.language")}</h2>
          <p className="text-sm text-ink/60">{t("settings.languageDesc")}</p>
        </div>
        <LanguageSwitcher />
      </div>

      <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">{t("settings.theme")}</h2>
          <p className="text-sm text-ink/60">{t("settings.themeDesc")}</p>
        </div>
        <ThemeToggle />
      </div>

      <Link href="/help" className="card flex items-center gap-3 p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
        <LifeBuoy size={20} className="shrink-0 text-orange-dark" />
        <div>
          <h2 className="font-semibold">{t("settings.help")}</h2>
          <p className="text-sm text-ink/60">{t("settings.helpDesc")}</p>
        </div>
      </Link>

      <div className="space-y-3">
        <div className="card space-y-1 p-5 pb-4">
          <h2 className="font-semibold">{t("location.update")}</h2>
          <p className="text-sm text-ink/60">{t("settings.locationDesc")}</p>
        </div>
        <LocationBar location={location} onManual={() => setDialogOpen(true)} onGps={switchToGps} />
      </div>

      <div className="card space-y-2 p-5">
        <h2 className="font-semibold">{t("settings.locationPrivacyTitle")}</h2>
        <p className="text-sm text-ink/60">{t("settings.locationPrivacyDesc")}</p>
      </div>

      {email && <p className="text-center text-sm text-ink/50">{t("settings.signedInAs", { email })}</p>}

      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="w-full rounded-full border border-red-200 bg-surface py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        {t("settings.logout")}
      </button>

      {dialogOpen && (
        <ManualLocationDialog
          onClose={() => setDialogOpen(false)}
          onSelect={(area) => {
            setManual(area);
            setDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
