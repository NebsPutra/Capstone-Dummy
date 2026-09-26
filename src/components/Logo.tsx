import { cn } from "@/lib/utils";

/**
 * Komunitas mark: a location pin (local discovery) holding three people
 * joined by an arc (community, connection) on a warm orange tile.
 * Works on light and dark backgrounds; the wordmark follows `currentColor`.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id="komunitas-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FB923C" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#komunitas-tile)" />
      <path d="M24 39s-11-9.6-11-18.2a11 11 0 0 1 22 0C35 29.4 24 39 24 39z" fill="#FFF8ED" />
      <circle cx="18.6" cy="21.6" r="2.6" fill="#F97316" />
      <circle cx="24" cy="17.6" r="2.8" fill="#EA580C" />
      <circle cx="29.4" cy="21.6" r="2.6" fill="#C2410C" />
      <path d="M17.2 27.4c1.9-2 4.2-3 6.8-3s4.9 1 6.8 3" stroke="#EA580C" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Logo({
  size = 30,
  className,
  wordmark = true,
}: {
  size?: number;
  className?: string;
  wordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} />
      {wordmark && (
        <span className="text-lg font-extrabold tracking-tight text-ink">
          Komunitas<span className="text-orange">.</span>
        </span>
      )}
    </span>
  );
}
