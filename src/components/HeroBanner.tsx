"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Lightbulb, Pause, Play, RefreshCw } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { jakartaHour } from "@/components/DashboardGreeting";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/reducedMotion";
import { GatherScene, ReadScene, RunScene, SchoolScene } from "@/components/landing/Scenes";

const INTERVAL_MS = 4000;

const SCENES = [<RunScene key="run" />, <ReadScene key="read" />, <SchoolScene key="school" />, <GatherScene key="gather" />];

const FACTS = [
  "fact.1", "fact.2", "fact.3", "fact.4", "fact.5", "fact.6", "fact.7", "fact.8", "fact.9", "fact.10",
] as const satisfies readonly TranslationKey[];

// Banner shade follows the four parts of the day (pagi/siang/sore/malam).
// All pass WCAG AA with white text (4.8:1 or better), so morning can only be slightly brighter.
function shadeFor(hour: number | null) {
  if (hour === null) return "#C2410C";
  if (hour >= 4 && hour < 11) return "#CC4410";
  if (hour >= 11 && hour < 15) return "#C2410C";
  if (hour >= 15 && hour < 18) return "#A9380F";
  return "#7C2D12";
}

function subscribeMinute(onChange: () => void) {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
}

// Start on the scene that best matches the user's main hobby.
function startScene(interestKey: string | null) {
  if (interestKey === "reading") return 1;
  if (interestKey === "running" || interestKey === "walking" || interestKey === "fitness") return 0;
  return 3;
}

/**
 * Dashboard hero: greeting, fact of the day and a small illustration. Kept
 * slim so activity cards start near the top; Explore and Create are already
 * in the sidebar and the bottom bar, so they aren't repeated here.
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
  const reducedMotion = useReducedMotion();
  const playing = choice ? choice === "play" : !reducedMotion;
  // Server snapshot null: the hour is only known on the client (avoids a hydration mismatch).
  const hour = useSyncExternalStore(subscribeMinute, () => jakartaHour(), () => null);
  // Fact of the day, then "next" cycles through the rest.
  const [fact, setFact] = useState(() => Math.floor(Date.now() / 86_400_000) % FACTS.length);

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % SCENES.length), INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [active, playing]);

  return (
    <section
      style={{ backgroundColor: shadeFor(hour) }}
      className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lift transition-colors duration-1000 md:flex md:items-center md:px-7 md:py-6">
      {/* Full 4:3 scenes (the frame keeps their ratio, so nothing is cropped); cross-fades like the landing slideshow. */}
      <div className="absolute inset-y-3 right-3 z-10 hidden aspect-[4/3] overflow-hidden rounded-2xl bg-cream sm:block">
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

      <div className="relative w-full sm:pr-60">
        <div className="space-y-3">
          <div className="text-white/90 [&_h1]:text-white [&_p]:text-white/80 md:[&_h1]:text-3xl md:[&_p]:mt-1">{greeting}</div>
          <div className="flex items-start gap-2 border-t border-white/15 pt-3 text-xs text-white/85 md:text-sm">
            <Lightbulb size={16} className="mt-0.5 shrink-0" aria-hidden />
            <p aria-live="polite" className="flex-1">
              <span className="font-semibold text-white">{t("fact.label")}</span> {t(FACTS[fact])}
            </p>
            <button
              type="button"
              onClick={() => setFact((i) => (i + 1) % FACTS.length)}
              aria-label={t("fact.next")}
              title={t("fact.next")}
              className="-m-1.5 shrink-0 rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
