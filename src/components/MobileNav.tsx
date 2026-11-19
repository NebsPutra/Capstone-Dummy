"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Plus,
  Search,
  CalendarDays,
  MessageCircle,
  User,
  Users,
  UsersRound,
  Megaphone,
  Bell,
  Settings,
  LifeBuoy,
  ShieldCheck,
  LayoutGrid,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { useReducedMotion } from "@/lib/reducedMotion";

type Item = { href: string; key: TranslationKey; icon: typeof Home };

// The bar: two items, the Create button in the middle, one item and "More".
const LEFT: Item[] = [
  { href: "/dashboard", key: "nav.dashboard", icon: Home },
  { href: "/explore", key: "nav.explore", icon: Search },
];
const RIGHT: Item = { href: "/my-activities", key: "nav.myActivities", icon: CalendarDays };

// Everything else lives in the "More" sheet.
const MORE: Item[] = [
  { href: "/messages", key: "nav.messages", icon: MessageCircle },
  { href: "/groups", key: "nav.groups", icon: UsersRound },
  { href: "/players", key: "nav.players", icon: Megaphone },
  { href: "/community", key: "nav.community", icon: Users },
  { href: "/notifications", key: "nav.notifications", icon: Bell },
  { href: "/profile", key: "nav.profile", icon: User },
  { href: "/settings", key: "nav.settings", icon: Settings },
  { href: "/help", key: "help.title", icon: LifeBuoy },
];

export function MobileNav({ isAdmin = false, unreadMessages = 0 }: { isAdmin?: boolean; unreadMessages?: number }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const sheet = useRef<HTMLDialogElement>(null);
  const more = isAdmin ? [...MORE, { href: "/admin", key: "nav.admin" as const, icon: ShieldCheck }] : MORE;
  const moreActive = more.some(({ href }) => pathname?.startsWith(href));
  // Slots: 0 Home, 1 Explore, 2 Create, 3 My activities, 4 More. The glass
  // bubble sits on the active one (not on Create, which is its own button).
  const active = [
    pathname?.startsWith(LEFT[0].href),
    pathname?.startsWith(LEFT[1].href),
    false,
    pathname?.startsWith(RIGHT.href),
    moreActive,
  ].indexOf(true);
  const { nav, goo, bubble } = useLiquidBubble(active);
  const reduced = useReducedMotion();
  const closing = useRef(false);

  // The sheet grows out of the "More" button like a drop, and melts back into it.
  const sheetMotion = (open: boolean) => {
    const d = sheet.current;
    const btn = nav.current?.querySelector<HTMLElement>('[data-slot="4"]');
    if (!d || !btn) return null;
    const p = d.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    d.style.transformOrigin = `${b.left + b.width / 2 - p.left}px ${Math.min(b.top + b.height / 2 - p.top, p.height)}px`;
    const grow = [
      { transform: "scale(0.14, 0.06)", borderRadius: "999px", opacity: 0.5 },
      { transform: "scale(0.4, 0.55)", borderRadius: "56px", opacity: 1, offset: 0.35 },
      { transform: "scale(1.03, 1.04)", borderRadius: "28px", offset: 0.68 },
      { transform: "scale(0.99, 0.985)", offset: 0.84 },
      { transform: "scale(1, 1)", borderRadius: "24px 24px 0 0" },
    ];
    const melt = [
      { transform: "scale(1, 1)", borderRadius: "24px 24px 0 0", opacity: 1 },
      { transform: "scale(0.4, 0.55)", borderRadius: "56px", offset: 0.6 },
      { transform: "scale(0.14, 0.06)", borderRadius: "999px", opacity: 0 },
    ];
    return open
      ? d.animate(grow, { duration: 560, easing: "cubic-bezier(.3,1.2,.5,1)" })
      : d.animate(melt, { duration: 300, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" });
  };
  const openSheet = () => {
    const d = sheet.current;
    if (!d || d.open) return;
    closing.current = false;
    d.showModal();
    if (reduced) return;
    sheetMotion(true);
    d.querySelectorAll("li").forEach((li, i) =>
      li.animate(
        [{ opacity: 0, transform: "translateY(14px) scale(0.85)" }, { opacity: 1, transform: "none" }],
        { duration: 380, delay: 200 + i * 35, easing: "cubic-bezier(.3,1.4,.5,1)", fill: "backwards" },
      ),
    );
  };
  const closeSheet = () => {
    const d = sheet.current;
    if (!d?.open || closing.current) return;
    if (reduced) return d.close();
    closing.current = true;
    const a = sheetMotion(false);
    if (!a) return d.close();
    a.onfinish = () => {
      d.close();
      a.cancel(); // drop the end frame so the next opening starts clean
      closing.current = false;
    };
  };

  // Close the sheet after navigating (unless it's already melting away).
  useEffect(() => {
    if (!closing.current) sheet.current?.close();
  }, [pathname]);

  const badge = unreadMessages > 0 && (
    <span className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-orange-deep px-1 text-center text-[10px] font-bold leading-4 text-white">
      {unreadMessages > 9 ? "9+" : unreadMessages}
    </span>
  );

  return (
    <>
      {/* Floating glass bar. The bubble and the liquid layer sit behind the items. */}
      <nav
        ref={nav}
        className="liquid-bar fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 items-center rounded-full p-1.5 md:hidden"
      >
        <svg aria-hidden width="0" height="0" className="absolute">
          {/* Blur + alpha threshold: overlapping drops merge like water ("gooey" effect). */}
          <filter id="liquid-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
            <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" />
          </filter>
        </svg>
        <div ref={goo} aria-hidden className="liquid-goo pointer-events-none absolute inset-0" />
        <span ref={bubble} aria-hidden className="liquid-bubble" />

        {LEFT.map((item, i) => (
          <NavLink key={item.href} item={item} active={active === i} label={t(item.key)} slot={i} />
        ))}

        <Link
          href="/create"
          data-slot={2}
          aria-current={pathname?.startsWith("/create") ? "page" : undefined}
          aria-label={t("nav.create")}
          className="relative z-10 flex justify-center"
        >
          {/* The main action: always the orange button. */}
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-deep text-white shadow-lift transition active:scale-95">
            <Plus size={24} strokeWidth={2.5} aria-hidden />
          </span>
        </Link>

        <NavLink item={RIGHT} active={active === 3} label={t(RIGHT.key)} slot={3} />

        <button
          type="button"
          data-slot={4}
          onClick={openSheet}
          aria-haspopup="dialog"
          className={cn(
            "relative z-10 flex flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-medium transition-colors",
            moreActive ? "text-orange-dark" : "text-ink/65"
          )}
        >
          <span className="relative">
            <LayoutGrid size={20} aria-hidden />
            {badge}
          </span>
          <span>{t("nav.more")}</span>
        </button>
      </nav>

      {/* Native <dialog>: focus trap, Escape and backdrop come for free. */}
      <dialog
        ref={sheet}
        aria-label={t("nav.more")}
        onClick={(e) => e.target === e.currentTarget && closeSheet()}
        onCancel={(e) => {
          e.preventDefault(); // Escape: animate out instead of vanishing
          closeSheet();
        }}
        className="liquid-sheet m-0 mt-auto w-full max-w-none rounded-t-3xl bg-surface p-0 text-ink backdrop:bg-ink/40 md:hidden"
      >
        <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">{t("nav.more")}</h2>
            <button
              type="button"
              onClick={closeSheet}
              aria-label={t("common.close")}
              className="rounded-full p-2 text-ink/70 hover:bg-cream-warm"
            >
              <X size={20} />
            </button>
          </div>
          <ul className="grid grid-cols-3 gap-2">
            {more.map(({ href, key, icon: Icon }) => {
              const active = pathname?.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={closeSheet}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center text-xs font-medium",
                      active ? "bg-orange/10 text-orange-dark" : "bg-cream-warm/60 text-ink/80 hover:bg-cream-warm"
                    )}
                  >
                    <span className="relative">
                      <Icon size={22} aria-hidden />
                      {href === "/messages" && badge}
                    </span>
                    {t(key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </dialog>
    </>
  );
}

function NavLink({
  item: { href, icon: Icon },
  active,
  label,
  slot,
}: {
  item: Item;
  active: boolean;
  label: string;
  slot: number;
}) {
  return (
    <Link
      href={href}
      data-slot={slot}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative z-10 flex flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-medium transition-colors",
        active ? "text-orange-dark" : "text-ink/65"
      )}
    >
      <Icon size={20} aria-hidden />
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}

const slotIn = (navEl: HTMLElement | null, i: number) => navEl?.querySelector<HTMLElement>(`[data-slot="${i}"]`) ?? null;

/** A tab's box relative to the bar. */
function boxIn(navEl: HTMLElement, i: number) {
  const n = navEl.getBoundingClientRect();
  const s = slotIn(navEl, i)!.getBoundingClientRect();
  return { x: s.left - n.left, w: s.width, y: s.top - n.top, h: s.height };
}

/**
 * The "liquid glass" bubble (after a liquid-glass navbar demo): on a tab change
 * the bubble melts into drops that flow to the new tab inside a gooey-filtered
 * layer, then a fresh bubble lands there with a small wobble and the icon pops.
 * Positions come from the slots' boxes; nothing re-renders during the motion
 * (Web Animations API). Reduced motion: the bubble just moves.
 * Tabs are found by their data-slot attribute.
 */
function useLiquidBubble(active: number) {
  const nav = useRef<HTMLElement>(null);
  const goo = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(null); // null = first render: no animation
  const reduced = useReducedMotion();


  // Keep the bubble on the active slot (also after rotating the phone).
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const b = bubble.current;
      if (!b || active < 0 || !slotIn(el, active)) return;
      const t = boxIn(el, active);
      Object.assign(b.style, { width: `${t.w}px`, height: `${t.h}px`, top: `${t.y}px`, transform: `translateX(${t.x}px)` });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [active]);

  useLayoutEffect(() => {
    const b = bubble.current;
    const layer = goo.current;
    const from = prev.current;
    prev.current = active;
    if (!b || !nav.current) return;
    if (active < 0 || !slotIn(nav.current, active)) {
      b.style.opacity = "0";
      return;
    }
    const t = boxIn(nav.current!, active);
    const at = (sx = 1, sy = 1) => `translateX(${t.x}px) scale(${sx}, ${sy})`;
    Object.assign(b.style, { width: `${t.w}px`, height: `${t.h}px`, top: `${t.y}px`, transform: at(), opacity: "1" });
    if (from === null || from === active || reduced) return;

    const land = from < 0 || !slotIn(nav.current, from) ? 0 : 380; // when the new bubble appears
    b.animate(
      [
        { opacity: 0, transform: at(0.55, 0.45) },
        { opacity: 1, transform: at(1.12, 0.86), offset: 0.55 },
        { transform: at(0.95, 1.06), offset: 0.78 },
        { transform: at() },
      ],
      { duration: 620, delay: land, easing: "cubic-bezier(.3,1.4,.5,1)", fill: "backwards" },
    );
    slotIn(nav.current, active)
      ?.querySelector("svg")
      ?.animate([{ transform: "scale(0.6)" }, { transform: "scale(1.2)", offset: 0.6 }, { transform: "scale(1)" }], {
        duration: 420,
        delay: land + 120,
        easing: "ease-out",
      });
    if (!land || !layer) return;

    // The liquid: the old bubble melts, drops flow over and merge at the target.
    const f = boxIn(nav.current!, from);
    const cy = f.y + f.h / 2;
    const fx = f.x + f.w / 2;
    const tx = t.x + t.w / 2;
    layer.replaceChildren();
    const drop = (w: number, h: number) => {
      const d = document.createElement("span");
      d.className = "liquid-drop";
      Object.assign(d.style, { width: `${w}px`, height: `${h}px`, left: `${-w / 2}px`, top: `${cy - h / 2}px` });
      layer.append(d);
      return d;
    };
    const ease = "cubic-bezier(.55,0,.35,1)";
    // Main blob: starts as the old bubble, stretches into a drop and travels.
    drop(f.w, f.h).animate(
      [
        { transform: `translateX(${fx}px) scale(1, 1)` },
        { transform: `translateX(${(fx + tx) / 2}px) scale(0.55, 0.5)`, offset: 0.55 },
        { transform: `translateX(${tx}px) scale(0.75, 0.7)` },
      ],
      { duration: 520, easing: ease, fill: "forwards" },
    );
    // Smaller drops trail behind it and catch up.
    [16, 11, 8].forEach((size, i) => {
      drop(size, size).animate(
        [{ transform: `translateX(${fx}px)` }, { transform: `translateX(${tx}px)` }],
        { duration: 470, delay: 50 + i * 55, easing: ease, fill: "both" }, // "both": wait at the start, not at the edge
      );
    });
    layer.animate([{ opacity: 0.4 }, { opacity: 0.4, offset: 0.7 }, { opacity: 0 }], { duration: 760, fill: "forwards" }).onfinish =
      () => layer.replaceChildren();
  }, [active, reduced]);

  return { nav, goo, bubble };
}
