"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, Search, CalendarDays, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";

const NAV: { href: string; key: TranslationKey; icon: typeof Home }[] = [
  { href: "/dashboard", key: "nav.dashboard", icon: Home },
  { href: "/explore", key: "nav.explore", icon: Search },
  { href: "/create", key: "nav.create", icon: PlusCircle },
  { href: "/my-activities", key: "nav.myActivities", icon: CalendarDays },
  { href: "/messages", key: "nav.messages", icon: MessageCircle },
  { href: "/profile", key: "nav.profile", icon: User },
];

export function MobileNav({ unreadMessages = 0 }: { unreadMessages?: number }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-ink/5 bg-surface/90 py-2 backdrop-blur-sm md:hidden">
      {NAV.map(({ href, key, icon: Icon }) => {
        const active = pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-medium",
              active ? "text-orange-dark" : "text-ink/65"
            )}
          >
            <span className="relative">
              <Icon size={20} />
              {href === "/messages" && unreadMessages > 0 && (
                <span className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-orange-deep px-1 text-center text-[10px] font-bold leading-4 text-white">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </span>
            <span className="max-w-full truncate">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
