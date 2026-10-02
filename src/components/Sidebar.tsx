"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Plus,
  Search,
  CalendarDays,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  LifeBuoy,
  MessageCircle,
  UsersRound,
  Megaphone,
} from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";

type Item = { href: string; key: TranslationKey; icon: typeof Home };

// Create is the button at the top; Profile and Notifications live in the header (avatar, bell).
const SECTIONS: { key: TranslationKey; items: Item[] }[] = [
  {
    key: "nav.section.discover",
    items: [
      { href: "/dashboard", key: "nav.dashboard", icon: Home },
      { href: "/explore", key: "nav.explore", icon: Search },
      { href: "/groups", key: "nav.groups", icon: UsersRound },
      { href: "/players", key: "nav.players", icon: Megaphone },
    ],
  },
  {
    key: "nav.section.you",
    items: [
      { href: "/my-activities", key: "nav.myActivities", icon: CalendarDays },
      { href: "/messages", key: "nav.messages", icon: MessageCircle },
      { href: "/community", key: "nav.community", icon: Users },
    ],
  },
];
const FOOTER: Item[] = [
  { href: "/settings", key: "nav.settings", icon: Settings },
  { href: "/help", key: "help.title", icon: LifeBuoy },
];

export function Sidebar({ isAdmin = false, unreadMessages = 0 }: { isAdmin?: boolean; unreadMessages?: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { t } = useLanguage();
  const footer = isAdmin ? [...FOOTER, { href: "/admin", key: "nav.admin" as const, icon: ShieldCheck }] : FOOTER;

  const link = ({ href, key, icon: Icon }: Item) => {
    const active = pathname?.startsWith(href);
    const label = t(key);
    const unread = href === "/messages" && unreadMessages > 0 ? (unreadMessages > 9 ? "9+" : String(unreadMessages)) : null;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? (unread ? `${label} (${unread})` : label) : undefined}
        title={collapsed ? label : undefined}
        className={cn(
          "relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition active:scale-[0.98]",
          collapsed && "justify-center px-0",
          active ? "bg-orange/10 text-orange-dark" : "text-ink/70 hover:bg-cream-warm hover:text-ink"
        )}
      >
        {/* Active marker on the sidebar's edge. */}
        {active && <span aria-hidden className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-orange" />}
        <span className="relative shrink-0">
          <Icon size={18} />
          {unread && collapsed && (
            <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-orange-deep px-1 text-center text-[10px] font-bold leading-4 text-white ring-2 ring-surface">
              {unread}
            </span>
          )}
        </span>
        {!collapsed && <span className="truncate">{label}</span>}
        {unread && !collapsed && (
          <span className="ml-auto rounded-full bg-orange-deep px-1.5 text-[11px] font-bold leading-[18px] text-white">{unread}</span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r border-ink/5 bg-surface transition-all duration-200 md:sticky md:top-0 md:flex md:h-screen md:flex-col",
        collapsed ? "w-[76px]" : "w-60"
      )}
    >
      <div className={cn("flex items-center px-4 pb-4 pt-5", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <Link href="/dashboard">
            <Logo size={28} />
          </Link>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-full p-1.5 text-ink/65 hover:bg-cream-warm"
          aria-label={t("nav.toggleSidebar")}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <div className="px-3">
        <Link
          href="/create"
          aria-current={pathname?.startsWith("/create") ? "page" : undefined}
          aria-label={collapsed ? t("nav.createActivity") : undefined}
          title={collapsed ? t("nav.createActivity") : undefined}
          className={cn(
            "flex h-10 items-center justify-center gap-2 rounded-full bg-orange-deep text-sm font-semibold text-white shadow-soft transition hover:bg-orange-deeper active:scale-[0.98]",
            collapsed && "mx-auto w-10"
          )}
        >
          <Plus size={18} strokeWidth={2.5} aria-hidden />
          {!collapsed && t("nav.createActivity")}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {SECTIONS.map(({ key, items }) => (
          <div key={key} className="mt-5">
            {collapsed ? (
              <hr className="mx-3 mb-2 border-ink/10" />
            ) : (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink/45">{t(key)}</p>
            )}
            <div className="space-y-0.5">{items.map(link)}</div>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-ink/5 px-3 py-3">{footer.map(link)}</div>
    </aside>
  );
}
