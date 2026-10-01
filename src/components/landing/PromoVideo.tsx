"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useReducedMotion } from "@/lib/reducedMotion";

/**
 * Landing hero video: the 30s promo, muted and looping. Has a pause button
 * (WCAG 2.2.2) and stays on its poster for prefers-reduced-motion users until
 * they press play. public/promo.mp4 is a silent 720p re-encode (~4 MB) of the
 * 1080p promo; replace both files together if the promo changes.
 */
export function PromoVideo() {
  const { t } = useLanguage();
  const ref = useRef<HTMLVideoElement>(null);
  const reducedMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false); // mirrors the element via onPlay/onPause
  const [userPaused, setUserPaused] = useState(false);

  // Autoplay unless the user paused or asked for less motion. Browsers refuse
  // autoplay in background tabs (and e.g. iOS Low Power Mode), so retry when
  // the tab becomes visible instead of giving up.
  useEffect(() => {
    const video = ref.current;
    if (!video || reducedMotion || userPaused) return;
    const tryPlay = () => {
      if (document.visibilityState === "visible") video.play().catch(() => {});
    };
    tryPlay();
    document.addEventListener("visibilitychange", tryPlay);
    return () => document.removeEventListener("visibilitychange", tryPlay);
  }, [reducedMotion, userPaused]);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    setUserPaused(playing);
    if (playing) video.pause();
    else video.play().catch(() => {});
  };

  return (
    <div className="w-full">
      <video
        ref={ref}
        src="/promo.mp4"
        poster="/promo-poster.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-label={t("landing.videoLabel")}
        className="aspect-video w-full rounded-3xl bg-cream-warm object-cover shadow-lift ring-1 ring-ink/5"
      />
      <div className="mt-3 flex justify-center md:justify-start">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? t("landing.videoPause") : t("landing.videoPlay")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 text-ink/70 hover:bg-surface hover:text-ink"
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
      </div>
    </div>
  );
}
