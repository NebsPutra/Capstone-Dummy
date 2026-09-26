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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";

const NAV: { href: string; key: TranslationKey; icon: typeof Home }[] = [
  { href: "/dashboard", key: "nav.dashboard", icon: Home },
  { href: "/create", key: "nav.create", icon: PlusCircle },
  { href: "/explore", key: "nav.explore", icon: Search },
  { href: "/my-activities", key: "nav.myActivities", icon: CalendarDays },
  { href: "/community", key: "nav.community", icon: Users },
  { href: "/notifications", key: "nav.notifications", icon: Bell },
  { href: "/profile", key: "nav.profile", icon: User },
  { href: "/settings", key: "nav.settings", icon: Settings },
];

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r border-ink/5 bg-white/60 backdrop-blur-sm transition-all duration-200 md:flex md:flex-col",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      <div className="flex items-center justify-between px-4 py-5">
        {!collapsed && (
          <Link href="/dashboard" className="text-lg font-extrabold text-orange-dark">
            Komunitas
          </Link>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto rounded-full p-1.5 text-ink/50 hover:bg-cream-warm"
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
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-orange text-white shadow-soft"
                  : "text-ink/70 hover:bg-cream-warm"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon size={19} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
