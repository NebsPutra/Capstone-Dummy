"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, Search, CalendarDays, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";

const NAV: { href: string; key: TranslationKey; icon: typeof Home }[] = [
  { href: "/dashboard", key: "nav.dashboard", icon: Home },
  { href: "/explore", key: "nav.explore", icon: Search },
  { href: "/create", key: "nav.create", icon: PlusCircle },
  { href: "/my-activities", key: "nav.myActivities", icon: CalendarDays },
  { href: "/profile", key: "nav.profile", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-ink/5 bg-white/90 py-2 backdrop-blur-sm md:hidden">
      {NAV.map(({ href, key, icon: Icon }) => {
        const active = pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium",
              active ? "text-orange-dark" : "text-ink/50"
            )}
          >
            <Icon size={20} />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
