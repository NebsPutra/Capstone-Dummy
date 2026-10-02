"use client";

import { useEffect, useRef } from "react";
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

  // Close the sheet after navigating.
  useEffect(() => {
    sheet.current?.close();
  }, [pathname]);

  const badge = unreadMessages > 0 && (
    <span className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-orange-deep px-1 text-center text-[10px] font-bold leading-4 text-white">
      {unreadMessages > 9 ? "9+" : unreadMessages}
    </span>
  );

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-end border-t border-ink/5 bg-surface/90 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-sm md:hidden">
        {LEFT.map((item) => (
          <NavLink key={item.href} item={item} active={Boolean(pathname?.startsWith(item.href))} label={t(item.key)} />
        ))}

        <Link
          href="/create"
          aria-current={pathname?.startsWith("/create") ? "page" : undefined}
          className="flex flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-medium text-ink/65"
        >
          {/* Raised above the bar: the main action. */}
          <span className="-mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-orange-deep text-white shadow-lift ring-4 ring-cream">
            <Plus size={26} strokeWidth={2.5} aria-hidden />
          </span>
          <span>{t("nav.create")}</span>
        </Link>

        <NavLink item={RIGHT} active={Boolean(pathname?.startsWith(RIGHT.href))} label={t(RIGHT.key)} />

        <button
          type="button"
          onClick={() => sheet.current?.showModal()}
          aria-haspopup="dialog"
          className={cn(
            "flex flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-medium",
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
        onClick={(e) => e.target === e.currentTarget && sheet.current?.close()}
        className="m-0 mt-auto w-full max-w-none rounded-t-3xl bg-surface p-0 text-ink backdrop:bg-ink/40 md:hidden"
      >
        <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">{t("nav.more")}</h2>
            <button
              type="button"
              onClick={() => sheet.current?.close()}
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
                    onClick={() => sheet.current?.close()}
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

function NavLink({ item: { href, icon: Icon }, active, label }: { item: Item; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-medium",
        active ? "text-orange-dark" : "text-ink/65"
      )}
    >
      <Icon size={20} aria-hidden />
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}
