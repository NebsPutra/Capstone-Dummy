import Link from "next/link";
import { Bell } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Header({
  name,
  avatarUrl,
}: {
  name?: string | null;
  avatarUrl?: string | null;
}) {
  return (
    <header className="flex items-center justify-between border-b border-ink/5 bg-white/60 px-4 py-3 backdrop-blur-sm md:px-6">
      <Link href="/dashboard" className="text-lg font-extrabold text-orange-dark md:hidden">
        Komunitas
      </Link>
      <div className="hidden md:block" />
      <div className="flex items-center gap-4">
        <LanguageSwitcher />
        <Link
          href="/notifications"
          className="rounded-full p-2 text-ink/60 hover:bg-cream-warm"
        >
          <Bell size={19} />
        </Link>
        <Link href="/profile" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-orange text-sm font-semibold text-white">
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
