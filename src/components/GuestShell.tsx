import Link from "next/link";
import { getServerT } from "@/lib/i18n/server";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { LegalFooter } from "./LegalFooter";
import { SkipLink } from "./SkipLink";

/**
 * Frame for logged-out visitors on guest pages (Explore, activity details):
 * the landing page's header with Sign in / Sign up instead of the app's
 * sidebar and bottom nav. `next` brings them back here after signing in.
 */
export async function GuestShell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { t } = await getServerT();
  const next = `?next=${encodeURIComponent(pathname)}`;
  return (
    <div className="ambient-gradient min-h-screen">
      <SkipLink />
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 md:px-8">
        <Link href="/" aria-label="Komunitas">
          <Logo size={32} wordmarkClassName="hidden min-[400px]:inline" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <ThemeToggle compact />
          </div>
          <LanguageSwitcher />
          <Link
            href={`/login${next}`}
            className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-ink/70 hover:bg-surface sm:px-4"
          >
            {t("landing.login")}
          </Link>
          <Link
            href={`/register${next}`}
            className="whitespace-nowrap rounded-full bg-orange-deep px-3 py-2 text-sm font-semibold text-white shadow-soft hover:bg-orange-deeper sm:px-4"
          >
            {t("landing.signup")}
          </Link>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-12 pt-2 outline-none md:px-8">
        {children}
        <LegalFooter className="mt-12" />
      </main>
    </div>
  );
}
