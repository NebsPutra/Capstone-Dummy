"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";

export function ProfileStatLabel({ translationKey }: { translationKey: string }) {
  const { t } = useLanguage();
  return <p className="text-xs text-ink/50">{t(translationKey)}</p>;
}
