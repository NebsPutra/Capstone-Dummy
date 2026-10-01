import { cn } from "@/lib/utils";

// Six people sitting in a circle (radius 12, every 60°) around one activity,
// on a 48x48 grid. Literal values, not Math.cos/sin: server and browser can
// differ in the last digit, which causes a hydration mismatch.
const PEOPLE = [
  [36, 24],
  [30, 34.4],
  [18, 34.4],
  [12, 24],
  [18, 13.6],
  [30, 13.6],
];

/**
 * The mark's shapes without the tile, in a 48x48 box. Shared by LogoMark,
 * the app icon, the link preview and the landing illustration (keep
 * src/app/icon.svg and favicon.ico in sync by hand). A plain function, not a
 * component: next/og only accepts intrinsic elements inside <svg>.
 */
export function markShapes() {
  return [
    <circle key="ring" cx="24" cy="24" r="12" fill="none" stroke="#FFF8ED" strokeOpacity="0.4" strokeWidth="1.5" />,
    <circle key="center" cx="24" cy="24" r="4.2" fill="#FFF8ED" />,
    ...PEOPLE.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="3.2" fill="#FFF8ED" />),
  ];
}

/**
 * Komunitas mark ("lingkaran"): people in a circle around one activity,
 * on a warm orange tile. Works on light and dark backgrounds; the wordmark
 * follows `currentColor`.
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
      {markShapes()}
    </svg>
  );
}

export function Logo({
  size = 30,
  className,
  wordmark = true,
  wordmarkClassName,
}: {
  size?: number;
  className?: string;
  wordmark?: boolean;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} />
      {wordmark && (
        <span className={cn("text-lg font-extrabold tracking-tight text-ink", wordmarkClassName)}>
          Komunitas<span className="text-orange">.</span>
        </span>
      )}
    </span>
  );
}
