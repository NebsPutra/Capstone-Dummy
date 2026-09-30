import { cn } from "@/lib/utils";

/**
 * Event banner or, if none, a plain panel with the category emoji.
 * The banner is shown whole (object-contain) whatever its ratio, over a
 * blurred copy of itself that fills the rest of the frame. Images are lazy-loaded.
 */
export function EventCover({
  bannerUrl,
  emoji,
  title,
  className,
}: {
  bannerUrl?: string | null;
  emoji?: string | null;
  title: string;
  className?: string;
}) {
  if (bannerUrl) {
    return (
      <div className={cn("relative w-full overflow-hidden bg-cream-warm", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bannerUrl}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bannerUrl}
          alt={title}
          loading="lazy"
          decoding="async"
          className="relative h-full w-full object-contain"
        />
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "flex w-full items-center justify-center bg-cream-warm",
        className
      )}
    >
      {emoji && <span className="text-4xl opacity-80">{emoji}</span>}
    </div>
  );
}
