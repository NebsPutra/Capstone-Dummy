import Link from "next/link";
import { Bell } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";

export function Header({
  name,
  avatarUrl,
  unread = 0,
}: {
  name?: string | null;
  avatarUrl?: string | null;
  unread?: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink/5 bg-surface/70 px-4 py-3 backdrop-blur-md md:px-6">
      <Link href="/dashboard" className="md:hidden">
        <Logo size={28} />
      </Link>
      <div className="hidden md:block" />
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden sm:block">
          <ThemeToggle compact />
        </div>
        <LanguageSwitcher />
        <Link href="/notifications" className="relative rounded-full p-2 text-ink/60 transition hover:bg-cream-warm active:scale-95" aria-label="notifications">
          <Bell size={19} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        <Link href="/profile" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-orange text-sm font-semibold text-white ring-2 ring-orange/20">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={name ?? "avatar"} className="h-full w-full object-cover" />
            ) : (
              (name?.[0] ?? "U").toUpperCase()
            )}
          </div>
          <span className="hidden text-sm font-medium sm:inline">{name}</span>
        </Link>
      </div>
    </header>
  );
}
