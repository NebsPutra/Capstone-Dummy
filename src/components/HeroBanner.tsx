"use client";

import Link from "next/link";
import { Bike, BookOpen, Footprints, MapPin, Trophy, Users } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const FLOATERS = [
  { Icon: Footprints, cls: "left-[6%] top-[18%]", delay: "0s" },
  { Icon: Bike, cls: "left-[34%] top-[8%]", delay: "0.8s" },
  { Icon: BookOpen, cls: "left-[62%] top-[26%]", delay: "1.6s" },
  { Icon: Trophy, cls: "left-[16%] top-[62%]", delay: "2.4s" },
  { Icon: Users, cls: "left-[48%] top-[60%]", delay: "0.4s" },
  { Icon: MapPin, cls: "left-[78%] top-[58%]", delay: "1.2s" },
];

/**
 * Dashboard hero: greeting + tagline + two CTAs, with a light illustration of
 * running, cycling, books, sports and community. Kept compact so activity
 * cards stay near the top of the page.
 */
export function HeroBanner({ greeting }: { greeting: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange via-orange/90 to-amber-400 p-6 text-white shadow-lift md:p-8">
      <span aria-hidden className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/15" />
      <span aria-hidden className="absolute -bottom-24 right-40 h-56 w-56 rounded-[45%] bg-amber-200/25" />
      <span aria-hidden className="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-white/10" />

      <div className="relative grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <div className="text-white/90 [&_h1]:text-white [&_p]:text-white/80">{greeting}</div>
          <h2 className="text-xl font-extrabold leading-tight md:text-2xl">{t("hero.title")}</h2>
          <p className="max-w-md text-sm text-white/85">{t("hero.subtitle")}</p>
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

        <div aria-hidden className="relative hidden h-44 md:block">
          {FLOATERS.map(({ Icon, cls, delay }) => (
            <span
              key={cls}
              className={`absolute flex h-14 w-14 animate-float items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm ${cls}`}
              style={{ animationDelay: delay }}
            >
              <Icon size={26} />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
