"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { GatherScene, ReadScene, RunScene } from "@/components/landing/Scenes";

// Landing illustration that best matches the user's main hobby.
function sceneFor(interestKey: string | null) {
  if (interestKey === "reading") return <ReadScene />;
  if (interestKey === "running" || interestKey === "walking" || interestKey === "fitness") return <RunScene />;
  return <GatherScene />;
}

/**
 * Dashboard hero: greeting + the two main actions. Kept compact so activity
 * cards stay near the top of the page.
 */
export function HeroBanner({
  greeting,
  primaryInterestKey,
}: {
  greeting: React.ReactNode;
  primaryInterestKey: string | null;
}) {
  const { t } = useLanguage();
    return (
    <section className="relative overflow-hidden rounded-3xl bg-orange-deep p-6 text-white shadow-lift md:p-8">
      {/* Wide crop of the 4:3 scene, centred on the people. */}
      <div className="absolute inset-y-4 right-4 hidden w-[44%] items-center overflow-hidden rounded-2xl sm:flex">
        <div className="aspect-[4/3] w-full shrink-0 translate-y-[4%]">{sceneFor(primaryInterestKey)}</div>
      </div>

      <div className="relative sm:pr-[48%]">
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
