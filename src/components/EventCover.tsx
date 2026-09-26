import { cn } from "@/lib/utils";

// Warm gradients per category so events without a banner still look distinct.
const GRADIENTS = [
  "from-orange/90 via-amber-400 to-rose-400",
  "from-amber-400 via-orange/80 to-orange-deep",
  "from-rose-400 via-orange/80 to-amber-300",
  "from-orange-deep via-orange/80 to-amber-300",
  "from-amber-300 via-rose-300 to-orange/90",
];

function gradientFor(key: string) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

/**
 * Event banner (16:9 upload) or, if none, a category-based illustration.
 * Images are lazy-loaded.
 */
export function EventCover({
  bannerUrl,
  categoryKey,
  emoji,
  title,
  className,
}: {
  bannerUrl?: string | null;
  categoryKey?: string | null;
  emoji?: string | null;
  title: string;
  className?: string;
}) {
  if (bannerUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={bannerUrl}
        alt={title}
        loading="lazy"
        decoding="async"
        className={cn("w-full bg-cream-warm object-cover", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden bg-gradient-to-br",
        gradientFor(categoryKey ?? title),
        className
      )}
    >
      <span className="absolute -left-6 -top-8 h-28 w-28 rounded-full bg-white/20 blur-sm" />
      <span className="absolute -bottom-10 right-4 h-32 w-32 rounded-[40%] bg-white/15" />
      <span className="absolute right-1/3 top-3 h-6 w-6 rounded-full bg-white/25" />
      <span className="relative text-5xl drop-shadow-sm">{emoji ?? "✨"}</span>
    </div>
  );
}
