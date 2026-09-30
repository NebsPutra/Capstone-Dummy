"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Lang, TranslationKey } from "@/lib/i18n/translations";

/** Current hour (0–23) in Asia/Jakarta, whatever the device's time zone. */
export function jakartaHour(now = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(now);
  return Number(h) % 24;
}

// Indonesian has four parts of the day (pagi/siang/sore/malam); English three.
function greetingKey(lang: Lang, hour: number): TranslationKey {
  if (lang === "id") {
    if (hour >= 4 && hour < 11) return "greet.morning";
    if (hour >= 11 && hour < 15) return "greet.midday";
    if (hour >= 15 && hour < 18) return "greet.afternoon";
    return "greet.evening";
  }
  if (hour >= 4 && hour < 12) return "greet.morning";
  if (hour >= 12 && hour < 18) return "greet.afternoon";
  return "greet.evening";
}

export function DashboardGreeting({ nickname }: { nickname: string | null | undefined }) {
  const { t, lang } = useLanguage();
  // Resolve the time after mount (and every minute) so server render and
  // client clock never disagree during hydration.
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setHour(jakartaHour());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const name = nickname?.trim();
  const greeting = hour === null ? null : t(greetingKey(lang, hour));

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {greeting === null
          ? name ? t("greet.hi", { name }) : t("greet.hiNoName")
          : name ? t("greet.named", { greeting, name }) : t("greet.plain", { greeting })}
      </h1>
      <p className="mt-1 text-ink/70">{t("dashboard.subtitle")}</p>
    </div>
  );
}
