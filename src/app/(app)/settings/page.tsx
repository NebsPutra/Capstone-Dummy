"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <LanguageSwitcher />
      </div>

      <div className="card space-y-2 p-5">
        <h2 className="font-semibold">{t("settings.locationPrivacyTitle")}</h2>
        <p className="text-sm text-ink/60">{t("settings.locationPrivacyDesc")}</p>
      </div>

      <button
        onClick={handleSignOut}
        className="w-full rounded-full border border-red-200 bg-white py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
      >
        {t("settings.logout")}
      </button>
    </div>
  );
}
