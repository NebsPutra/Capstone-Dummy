"use client";

import Link from "next/link";
import { MapPin, Users, PlusCircle, Repeat } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function LandingPage() {
  const { t } = useLanguage();

  const FEATURES = [
    { icon: MapPin, title: t("landing.feature1Title"), desc: t("landing.feature1Desc") },
    { icon: Users, title: t("landing.feature2Title"), desc: t("landing.feature2Desc") },
    { icon: PlusCircle, title: t("landing.feature3Title"), desc: t("landing.feature3Desc") },
    { icon: Repeat, title: t("landing.feature4Title"), desc: t("landing.feature4Desc") },
  ];

  return (
    <main className="ambient-gradient min-h-screen">
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <span className="text-xl font-extrabold text-orange-dark">Komunitas</span>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-ink/70 hover:bg-white"
          >
            {t("landing.login")}
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-orange-dark"
          >
            {t("landing.signup")}
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center md:py-28">
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
          {t("landing.headline1")}
          <br />
          <span className="text-orange-dark">{t("landing.headline2")}</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-ink/60">
          {t("landing.subheadline")}
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/explore"
            className="w-full rounded-full bg-orange px-7 py-3.5 text-center text-base font-semibold text-white shadow-soft hover:bg-orange-dark sm:w-auto"
          >
            {t("landing.ctaExplore")}
          </Link>
          <Link
            href="/register"
            className="w-full rounded-full border border-orange/30 bg-white px-7 py-3.5 text-center text-base font-semibold text-orange-dark hover:bg-cream-warm sm:w-auto"
          >
            {t("landing.ctaCreate")}
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-orange/10 text-orange-dark">
                <Icon size={22} />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-ink/60">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
