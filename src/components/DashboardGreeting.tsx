"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";

function greetingKey(hour: number): TranslationKey {
  return hour < 11 ? "dashboard.goodMorning" : hour < 17 ? "dashboard.goodAfternoon" : "dashboard.goodEvening";
}

export function DashboardGreeting({ name }: { name: string }) {
  const { t } = useLanguage();
  // Resolve the hour after mount so server (UTC) and client clocks don't
  // produce a hydration mismatch.
  const [key, setKey] = useState<TranslationKey | null>(null);
  useEffect(() => setKey(greetingKey(new Date().getHours())), []);

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {key ? `${t(key)}, ` : ""}
        {name} 👋
      </h1>
      <p className="mt-1 text-ink/60">{t("dashboard.subtitle")}</p>
    </div>
  );
}
