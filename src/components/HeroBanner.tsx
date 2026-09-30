"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * Dashboard hero: greeting + the two main actions. Kept compact so activity
 * cards stay near the top of the page.
 */
export function HeroBanner({ greeting }: { greeting: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <section className="relative overflow-hidden rounded-3xl bg-orange-deep p-6 text-white shadow-lift md:p-8">
      <div className="relative">
        <div className="space-y-3">
          <div className="text-white/90 [&_h1]:text-white [&_p]:text-white/80">{greeting}</div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/explore"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-orange-deep shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.97]"
            >
              {t("hero.explore")}
            </Link>
            <Link
              href="/create"
              className="rounded-full border border-white/60 px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10 active:scale-[0.97]"
            >
              {t("hero.create")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
