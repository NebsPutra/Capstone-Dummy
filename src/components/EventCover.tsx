"use client";

import Image from "next/image";
import {
  Bike,
  BookOpenText,
  Dribbble,
  Feather,
  Footprints,
  Gamepad2,
  HeartHandshake,
  MessagesSquare,
  PersonStanding,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/** Per-category look for generated posters: two colour pairs and an icon. */
const THEMES: Record<string, { colors: [string, string][]; icon: typeof Bike }> = {
  group_run: { colors: [["#f97316", "#9a3412"], ["#fb923c", "#c2410c"]], icon: Footprints },
  walking: { colors: [["#65a30d", "#365314"], ["#84cc16", "#3f6212"]], icon: PersonStanding },
  reading_together: { colors: [["#0d9488", "#134e4a"], ["#14b8a6", "#115e59"]], icon: BookOpenText },
  book_discussion: { colors: [["#0e7490", "#164e63"], ["#0891b2", "#155e75"]], icon: MessagesSquare },
  cycling: { colors: [["#0284c7", "#0c4a6e"], ["#0ea5e9", "#075985"]], icon: Bike },
  badminton: { colors: [["#059669", "#064e3b"], ["#10b981", "#065f46"]], icon: Feather },
  basketball: { colors: [["#d97706", "#78350f"], ["#ea580c", "#7c2d12"]], icon: Dribbble },
  futsal: { colors: [["#16a34a", "#14532d"], ["#22c55e", "#166534"]], icon: Trophy },
  gaming: { colors: [["#4f46e5", "#1e1b4b"], ["#6366f1", "#312e81"]], icon: Gamepad2 },
  community_gathering: { colors: [["#e11d48", "#881337"], ["#f43f5e", "#9f1239"]], icon: Users },
  social_activity: { colors: [["#db2777", "#831843"], ["#ec4899", "#9d174d"]], icon: HeartHandshake },
};
const FALLBACK = { colors: [["#57534e", "#1c1917"], ["#78716c", "#292524"]] as [string, string][], icon: Sparkles };

// Low-contrast background patterns; each poster gets one, picked from its id.
const PATTERNS = [
  "radial-gradient(rgb(255 255 255 / 0.16) 1.5px, transparent 1.6px) 0 0 / 18px 18px",
  "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.09) 0 10px, transparent 10px 24px)",
  "repeating-radial-gradient(circle at 85% 110%, rgb(255 255 255 / 0.1) 0 2px, transparent 2px 26px)",
  "linear-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px) 0 0 / 100% 22px",
];

/** Small stable hash (FNV-1a), so the same activity always gets the same poster. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Activity cover. With a banner: the banner shown whole (object-contain) over a
 * blurred copy of itself (both resized by next/image). Without one: a generated poster made from the
 * activity itself (category colours and icon, a pattern and tilt picked from
 * its id and a date ticket), so every activity looks
 * different. Images are lazy-loaded.
 */
export function EventCover({
  bannerUrl,
  title,
  className,
  seed,
  categoryKey,
  date,
  sizes = "(max-width: 768px) 100vw, 400px",
  eager,
}: {
  bannerUrl?: string | null;
  /** Kept for callers that still pass it; the poster uses the category icon instead. */
  emoji?: string | null;
  title: string;
  className?: string;
  /** Usually the activity id: picks the poster's pattern and colour variant. */
  seed?: string;
  categoryKey?: string | null;
  /** YYYY-MM-DD: shown as a date ticket on the poster. (Always light: fixed dark text, not the ink token.) */
  date?: string | null;
  /** Rendered width hint for the image optimizer (cards ~400px; pass more for big covers). */
  sizes?: string;
  /** Above the fold (first cards, page hero): load now, not lazily. */
  eager?: boolean;
}) {
  const { lang } = useLanguage();

  if (bannerUrl) {
    return (
      <div className={cn("relative w-full overflow-hidden bg-cream-warm", className)}>
        {/* Resized and re-encoded by Next's image optimizer: uploads can be large originals. */}
        <Image src={bannerUrl} alt="" aria-hidden fill sizes="48px" className="scale-110 object-cover opacity-70 blur-2xl" />
        <Image src={bannerUrl} alt={title} fill sizes={sizes} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} className="object-contain" />
      </div>
    );
  }

  const h = hash(seed || title);
  const theme = (categoryKey && THEMES[categoryKey]) || FALLBACK;
  const [from, to] = theme.colors[h % theme.colors.length];
  const pattern = PATTERNS[(h >>> 3) % PATTERNS.length];
  const angle = 115 + ((h >>> 6) % 50); // 115-164deg
  const tilt = -18 + ((h >>> 9) % 24); // icon rotation, -18..5deg
  const Icon = theme.icon;
  // Read as a UTC calendar date so server and browser render the same text.
  const day = date ? new Date(`${date}T00:00:00Z`) : null;
  const locale = lang === "id" ? "id-ID" : "en-GB";

  return (
    <div
      role="img"
      aria-label={title}
      className={cn("relative w-full overflow-hidden text-white", className)}
      style={{ background: `${pattern}, linear-gradient(${angle}deg, ${from}, ${to})` }}
    >
      {/* Big category icon, cropped by the edge. */}
      <Icon
        aria-hidden
        strokeWidth={1.25}
        className="absolute -bottom-[18%] -right-[4%] h-[95%] w-auto text-white/20"
        style={{ transform: `rotate(${tilt}deg)` }}
      />
      {day && (
        <div className="absolute left-[5%] top-[12%] flex min-w-[3.25rem] flex-col items-center rounded-xl bg-white/95 px-2.5 py-1.5 text-center text-stone-800 shadow-lift">
          <span className="text-[10px] font-bold uppercase tracking-wide text-orange-deep">
            {day.toLocaleDateString(locale, { month: "short", timeZone: "UTC" })}
          </span>
          <span className="text-xl font-extrabold leading-none">{day.getUTCDate()}</span>
          <span className="text-[10px] font-semibold text-stone-500">{day.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" })}</span>
        </div>
      )}
    </div>
  );
}
