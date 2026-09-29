"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { cn } from "@/lib/utils";

/** Links to the legal pages and About/contact, shown on public pages and in the app. */
export function LegalFooter({ className }: { className?: string }) {
  const { t } = useLanguage();
  const links = [
    { href: "/legal/privacy", label: t("legal.privacy") },
    { href: "/legal/terms", label: t("legal.terms") },
    { href: "/legal/refunds", label: t("legal.refunds") },
    { href: "/legal/cookies", label: t("legal.cookies") },
    { href: "/about", label: t("legal.about") },
  ];
  return (
    <footer className={cn("text-xs text-ink/65", className)}>
      <nav aria-label={t("legal.onThisPage")} className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="rounded hover:text-orange-dark hover:underline">
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="mt-2 text-center">{t("legal.rights", { year: new Date().getFullYear() })}</p>
    </footer>
  );
}
