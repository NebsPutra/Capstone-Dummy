"use client";

import { useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/reducedMotion";

// Where the last tap/click happened (viewport coordinates, time).
let lastTap = { x: 0, y: 0, t: -Infinity };
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", (e) => (lastTap = { x: e.clientX, y: e.clientY, t: performance.now() }), {
    capture: true,
    passive: true,
  });
}

/**
 * Page change, the liquid way (matches the tab bar and the "More" sheet): the
 * new page spreads out from where you tapped, then settles with a small
 * wobble. Only after a tap, so reloads, first visits and the back button show
 * the page plainly. Off for reduced motion. Used by the route templates, which
 * re-mount on every navigation. No fill: the transform is gone once it ends,
 * so position:fixed children (pinned bars) behave normally afterwards.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced || performance.now() - lastTap.t > 3000) return;
    const r = el.getBoundingClientRect();
    const visibleH = Math.max(0, Math.min(r.height, window.innerHeight - r.top));
    // Taps outside the page (desktop sidebar, phone tab bar) start from the
    // nearest point of the page, so it doesn't stay blank while the circle travels.
    const x = Math.min(Math.max(lastTap.x - r.left, 0), r.width);
    const y = Math.min(Math.max(lastTap.y - r.top, 0), visibleH);
    // Radius that covers the visible part of the page from that point.
    const R = Math.hypot(Math.max(x, r.width - x), Math.max(y, visibleH - y)) + 24;
    const at = `at ${x}px ${y}px`;
    el.animate(
      [
        { clipPath: `circle(28px ${at})`, opacity: 0.6 },
        { clipPath: `circle(${R}px ${at})`, opacity: 1, offset: 0.85 },
        { clipPath: `circle(${R}px ${at})`, opacity: 1 },
      ],
      { duration: 520, easing: "cubic-bezier(.45,0,.2,1)" },
    );
    el.style.transformOrigin = `${x}px ${y}px`;
    el.animate(
      [
        { transform: "scale(0.97)" },
        { transform: "scale(1.008, 1.004)", offset: 0.62 },
        { transform: "scale(0.998, 1.001)", offset: 0.82 },
        { transform: "scale(1)" },
      ],
      { duration: 620, easing: "ease-out" },
    );
  }, [reduced]);

  return <div ref={ref}>{children}</div>;
}
