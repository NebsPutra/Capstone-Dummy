"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { INTERVAL_MS, REDUCED_MOTION, subscribeReducedMotion } from "@/components/landing/ActivitySlideshow";
import { GatherScene, ReadScene, RunScene, SchoolScene } from "@/components/landing/Scenes";

const SCENES = [<RunScene key="run" />, <ReadScene key="read" />, <SchoolScene key="school" />, <GatherScene key="gather" />];

// Start on the scene that best matches the user's main hobby.
function startScene(interestKey: string | null) {
  if (interestKey === "reading") return 1;
  if (interestKey === "running" || interestKey === "walking" || interestKey === "fitness") return 0;
  return 3;
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
  const [active, setActive] = useState(() => startScene(primaryInterestKey));
  const [choice, setChoice] = useState<"play" | "pause" | null>(null); // explicit button press wins
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false
  );
  const playing = choice ? choice === "play" : !reducedMotion;

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % SCENES.length), INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [active, playing]);

  return (
    <section className="relative overflow-hidden rounded-3xl bg-orange-deep p-6 text-white shadow-lift md:min-h-[15rem] md:p-8">
      {/* Full 4:3 scenes (the frame keeps their ratio, so nothing is cropped); cross-fades like the landing slideshow. */}
      <div className="absolute inset-y-4 right-4 z-10 hidden aspect-[4/3] overflow-hidden rounded-2xl bg-cream sm:block">
        {SCENES.map((scene, i) => (
          <div
            key={i}
            aria-hidden
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-out",
              i === active ? "opacity-100" : "opacity-0"
            )}
          >
            {scene}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setChoice(playing ? "pause" : "play")}
          aria-label={playing ? t("landing.slidePause") : t("landing.slidePlay")}
          className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-ink/70 shadow-soft hover:bg-white hover:text-ink"
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
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
