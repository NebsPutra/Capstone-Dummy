"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { LegalFooter } from "@/components/LegalFooter";
import { PromoVideo } from "@/components/landing/PromoVideo";
import { UpcomingActivities } from "@/components/landing/UpcomingActivities";

export default function LandingPage() {
  const { t } = useLanguage();
  const [deleted, setDeleted] = useState(false);
  useEffect(() => {
    // Set by the account deletion flow (DeleteAccount.tsx).
    if (new URLSearchParams(window.location.search).get("deleted") === "1") setDeleted(true);
  }, []);

  const FEATURES = [
    { title: t("landing.feature1Title"), desc: t("landing.feature1Desc") },
    { title: t("landing.feature2Title"), desc: t("landing.feature2Desc") },
    { title: t("landing.feature3Title"), desc: t("landing.feature3Desc") },
    { title: t("landing.feature4Title"), desc: t("landing.feature4Desc") },
  ];

  return (
    <main className="ambient-gradient min-h-screen">
      <header className="flex items-center justify-between gap-2 px-4 py-5 sm:px-6 md:px-12">
        {/* The full wordmark doesn't fit beside the header actions on narrow phones. */}
        <Logo size={34} wordmarkClassName="hidden min-[400px]:inline" />
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <ThemeToggle compact />
          </div>
          <LanguageSwitcher />
          <Link
            href="/login"
            className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-ink/70 hover:bg-surface sm:px-4"
          >
            {t("landing.login")}
          </Link>
          <Link
            href="/register"
            className="whitespace-nowrap rounded-full bg-orange-deep px-3 py-2 text-sm font-semibold text-white shadow-soft hover:bg-orange-deeper sm:px-4"
          >
            {t("landing.signup")}
          </Link>
        </div>
      </header>

      {deleted && (
        <p role="status" className="mx-auto max-w-md rounded-xl bg-success-soft px-4 py-3 text-center text-sm font-medium text-success">
          {t("deleteAccount.done")}
        </p>
      )}
      {/* Full-width band: video left, copy right on desktop; copy first on phones so the CTAs stay in view. */}
      <section className="bg-cream-warm/50">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-12 md:grid-cols-2 md:gap-12 md:py-16">
          <div className="text-center md:order-last md:text-left">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              <span className="block">{t("landing.headline1")}</span>
              <span className="block">{t("landing.headline2")}</span>
              <span className="block text-orange-dark">{t("landing.headline3")}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-ink/70 md:mx-0">
              {t("landing.subheadline")}
            </p>
            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
              <Link
                href="/explore"
                className="w-full rounded-full bg-orange-deep px-7 py-3.5 text-center text-base font-semibold text-white shadow-soft hover:bg-orange-deeper sm:w-auto"
              >
                {t("landing.ctaExplore")}
              </Link>
              <Link
                href="/register"
                className="w-full rounded-full border border-orange/30 bg-surface px-7 py-3.5 text-center text-base font-semibold text-orange-dark hover:bg-cream-warm sm:w-auto"
              >
                {t("landing.ctaCreate")}
              </Link>
            </div>
          </div>
          <PromoVideo />
        </div>
      </section>

      <UpcomingActivities />

      <section className="mx-auto max-w-5xl px-6 pb-24 pt-16">
        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ title, desc }) => (
            <li key={title} className="border-t border-ink/10 pt-4">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-ink/70">{desc}</p>
            </li>
          ))}
        </ul>
      </section>
      <LegalFooter className="px-6 pb-10" />
    </main>
  );
}
