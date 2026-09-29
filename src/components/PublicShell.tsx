import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerT } from "@/lib/i18n/server";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { LegalFooter } from "./LegalFooter";
import { SkipLink } from "./SkipLink";

/** Frame for public reading pages (legal documents, About). */
export async function PublicShell({ children }: { children: React.ReactNode }) {
  const { t } = await getServerT();
  return (
    <div className="ambient-gradient min-h-screen">
      <SkipLink />
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-5">
        <Link href="/" aria-label="Komunitas">
          <Logo size={32} wordmarkClassName="hidden min-[400px]:inline" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <LanguageSwitcher />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 pb-10">
        <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-orange-dark hover:underline">
          <ArrowLeft size={15} aria-hidden /> {t("legal.back")}
        </Link>
        {children}
      </main>
      <LegalFooter className="pb-10" />
    </div>
  );
}
