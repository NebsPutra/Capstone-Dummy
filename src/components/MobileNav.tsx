"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, PlusCircle, Search, CalendarDays, MessageCircle, User, Users, UsersRound, Megaphone, Bell, Settings, LifeBuoy, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";

const NAV: { href: string; key: TranslationKey; icon: typeof Home }[] = [
  { href: "/dashboard", key: "nav.dashboard", icon: Home },
  { href: "/explore", key: "nav.explore", icon: Search },
  { href: "/create", key: "nav.create", icon: PlusCircle },
  { href: "/my-activities", key: "nav.myActivities", icon: CalendarDays },
  { href: "/groups", key: "nav.groups", icon: UsersRound },
  { href: "/players", key: "nav.players", icon: Megaphone },
  { href: "/messages", key: "nav.messages", icon: MessageCircle },
  { href: "/profile", key: "nav.profile", icon: User },
  { href: "/community", key: "nav.community", icon: Users },
  { href: "/notifications", key: "nav.notifications", icon: Bell },
  { href: "/settings", key: "nav.settings", icon: Settings },
  { href: "/help", key: "help.title", icon: LifeBuoy },
];

export function MobileNav({ isAdmin = false, unreadMessages = 0 }: { isAdmin?: boolean; unreadMessages?: number }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center overflow-x-auto border-t border-ink/5 bg-surface/90 py-2 backdrop-blur-sm [scrollbar-width:none] md:hidden">
      {/* ~5.5 items visible so the cut-off one hints that the bar scrolls. */}
      {(isAdmin ? [...NAV, { href: "/admin", key: "nav.admin" as const, icon: ShieldCheck }] : NAV).map(({ href, key, icon: Icon }) => {
        const active = pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex w-[18%] shrink-0 flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-medium",
              active ? "text-orange-dark" : "text-ink/65"
            )}
          >
            {href === "/create" ? (
              // The main action: an orange button, third item so it sits mid-screen. (Not raised
              // above the bar: the bar scrolls sideways, which would clip it.)
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-deep text-white shadow-soft">
                <Plus size={22} strokeWidth={2.5} />
              </span>
            ) : (
            <span className="relative">
              <Icon size={20} />
              {href === "/messages" && unreadMessages > 0 && (
                <span className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-orange-deep px-1 text-center text-[10px] font-bold leading-4 text-white">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </span>
            )}
            <span className="max-w-full truncate">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
