"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";

export function DashboardGreeting({ name }: { name: string }) {
  const { t } = useLanguage();
  const hour = new Date().getHours();
  const greetingKey =
    hour < 11 ? "dashboard.goodMorning" : hour < 17 ? "dashboard.goodAfternoon" : "dashboard.goodEvening";

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {t(greetingKey)}, {name} 👋
      </h1>
      <p className="mt-1 text-ink/60">{t("dashboard.subtitle")}</p>
    </div>
  );
}

export function SectionTitle({ translationKey }: { translationKey: string }) {
  const { t } = useLanguage();
  return <h2 className="mb-4 text-lg font-semibold">{t(translationKey)}</h2>;
}
