"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Settings, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * App header: notifications bell and an account menu (avatar). Theme and
 * language live in that menu: they're set once, so they don't need header space.
 * The menu is a native popover: outside click and Escape close it.
 */
export function Header({
  name,
  avatarUrl,
  unread = 0,
}: {
  name?: string | null;
  avatarUrl?: string | null;
  unread?: number;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const notificationsLabel = unread > 0 ? `${t("nav.notifications")} (${unread})` : t("nav.notifications");
  const close = () => document.getElementById("account-menu")?.hidePopover();

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink/5 bg-surface/70 px-4 py-3 backdrop-blur-md md:px-6">
      <Link href="/dashboard" className="md:hidden">
        <Logo size={28} />
      </Link>
      <div className="hidden md:block" />
      <div className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/notifications"
          className="relative rounded-full p-2 text-ink/70 transition hover:bg-cream-warm active:scale-95"
          aria-label={notificationsLabel}
        >
          <Bell size={19} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-deep px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>

        <button
          type="button"
          popoverTarget="account-menu"
          aria-label={t("nav.accountMenu")}
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-cream-warm"
        >
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-orange-deep text-sm font-semibold text-white ring-2 ring-orange/20">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden>{(name?.[0] ?? "U").toUpperCase()}</span>
            )}
          </span>
          <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">{name || t("nav.profile")}</span>
          <ChevronDown size={15} className="text-ink/60" aria-hidden />
        </button>

        <div
          id="account-menu"
          popover="auto"
          className="fixed inset-auto right-4 top-14 m-0 w-64 rounded-2xl border border-ink/10 bg-surface p-2 text-ink shadow-lift md:right-6"
        >
          <Link href="/profile" onClick={close} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-cream-warm">
            <User size={17} aria-hidden /> {t("nav.profile")}
          </Link>
          <Link href="/settings" onClick={close} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-cream-warm">
            <Settings size={17} aria-hidden /> {t("nav.settings")}
          </Link>
          <div className="my-2 space-y-2.5 border-y border-ink/10 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-ink/70">{t("theme.title")}</span>
              <ThemeToggle compact />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-ink/70">{t("settings.language")}</span>
              <LanguageSwitcher />
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
          >
            <LogOut size={17} aria-hidden /> {t("settings.logout")}
          </button>
        </div>
      </div>
    </header>
  );
}
