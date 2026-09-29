"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";

/** First focusable element: lets keyboard users jump past the navigation. */
export function SkipLink() {
  const { t } = useLanguage();
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[1000] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lift"
    >
      {t("a11y.skip")}
    </a>
  );
}
