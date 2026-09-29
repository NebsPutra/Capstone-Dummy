"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Pause, Play } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { GatherScene, ReadScene, RunScene, SchoolScene } from "./Scenes";

const SLIDES = [
  { Scene: RunScene, key: "slide1" },
  { Scene: ReadScene, key: "slide2" },
  { Scene: SchoolScene, key: "slide3" },
  { Scene: GatherScene, key: "slide4" },
] as const;

const INTERVAL_MS = 4500;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Landing hero illustration: auto-rotating slides of activities people run on
 * Komunitas. Pauses on hover/focus and with the pause button (WCAG 2.2.2), and
 * doesn't auto-rotate for prefers-reduced-motion users.
 */
export function ActivitySlideshow({ className }: { className?: string }) {
  const { t } = useLanguage();
  const [active, setActive] = useState(0);
  const [choice, setChoice] = useState<"play" | "pause" | null>(null); // explicit button press wins
  const [held, setHeld] = useState(false); // hover or keyboard focus inside
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false
  );
  const playing = choice ? choice === "play" : !reducedMotion;

  useEffect(() => {
    if (!playing || held) return;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % SLIDES.length), INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [active, playing, held]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("landing.slidesLabel")}
      className={cn("w-full", className)}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false);
      }}
    >
      <div
        className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-lift ring-1 ring-ink/5">
        {SLIDES.map(({ Scene, key }, i) => (
          <div
            key={key}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${SLIDES.length}: ${t(`landing.${key}Title`)}`}
            aria-hidden={i !== active}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-out",
              i === active ? "opacity-100" : "opacity-0"
            )}
          >
            <Scene />
          </div>
        ))}
      </div>

      <div aria-live={playing ? "off" : "polite"} className="mt-4 min-h-[3.25rem] text-center md:text-left">
        <p key={active} className="animate-fade-in text-lg font-bold leading-tight">
          {t(`landing.${SLIDES[active].key}Title`)}
        </p>
        <p key={`d${active}`} className="mt-0.5 animate-fade-in text-sm text-ink/70">
          {t(`landing.${SLIDES[active].key}Desc`)}
        </p>
      </div>

      <div className="mt-2 flex items-center justify-center gap-1 md:justify-start md:-ml-2">
        {SLIDES.map(({ key }, i) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(i)}
            aria-label={t("landing.slideGoTo", { n: i + 1 })}
            aria-current={i === active}
            className="flex h-8 w-8 items-center justify-center rounded-full"
          >
            <span
              className={cn(
                "block h-2 rounded-full transition-all duration-300",
                i === active ? "w-6 bg-orange-dark" : "w-2 bg-ink/20 hover:bg-ink/35"
              )}
            />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setChoice(playing ? "pause" : "play")}
          aria-label={playing ? t("landing.slidePause") : t("landing.slidePlay")}
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-ink/60 hover:bg-surface hover:text-ink"
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
      </div>
    </section>
  );
}
