"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  PlusCircle,
  Search,
  CalendarDays,
  Users,
  Bell,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  LifeBuoy,
  MessageCircle,
} from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";

const NAV: { href: string; key: TranslationKey; icon: typeof Home }[] = [
  { href: "/dashboard", key: "nav.dashboard", icon: Home },
  { href: "/create", key: "nav.create", icon: PlusCircle },
  { href: "/explore", key: "nav.explore", icon: Search },
  { href: "/my-activities", key: "nav.myActivities", icon: CalendarDays },
  { href: "/community", key: "nav.community", icon: Users },
  { href: "/messages", key: "nav.messages", icon: MessageCircle },
  { href: "/notifications", key: "nav.notifications", icon: Bell },
  { href: "/profile", key: "nav.profile", icon: User },
  { href: "/settings", key: "nav.settings", icon: Settings },
  { href: "/help", key: "help.title", icon: LifeBuoy },
];

export function Sidebar({ isAdmin = false, unreadMessages = 0 }: { isAdmin?: boolean; unreadMessages?: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r border-ink/5 bg-surface transition-all duration-200 md:flex md:flex-col",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      <div className="flex items-center justify-between px-4 py-5">
        {!collapsed && (
          <Link href="/dashboard">
            <Logo size={30} />
          </Link>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto rounded-full p-1.5 text-ink/65 hover:bg-cream-warm"
          aria-label={t("nav.toggleSidebar")}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {(isAdmin ? [...NAV, { href: "/admin", key: "nav.admin" as const, icon: ShieldCheck }] : NAV).map(({ href, key, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          const label = t(key);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition active:scale-[0.98]",
                active
                  ? "bg-orange-deep text-white shadow-soft"
                  : "text-ink/70 hover:bg-cream-warm"
              )}
              title={collapsed ? label : undefined}
            >
              <span className="relative shrink-0">
                <Icon size={19} />
                {href === "/messages" && unreadMessages > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-orange-deep px-1 text-center text-[10px] font-bold leading-4 text-white ring-2 ring-surface">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </span>
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
