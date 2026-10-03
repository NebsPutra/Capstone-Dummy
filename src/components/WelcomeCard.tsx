"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, MapPin, Megaphone, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const KEY = "komunitas-welcome-dismissed";

/** First-time dashboard guidance: three steps, shown until dismissed (per device). */
export function WelcomeCard() {
  const { t } = useLanguage();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) setShow(true);
    } catch {
      // storage blocked: skip the card rather than show it forever
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  }

  const steps = [
    { icon: MapPin, title: t("welcome.step1"), body: t("welcome.step1Body"), href: "/settings" },
    { icon: CalendarCheck, title: t("welcome.step2"), body: t("welcome.step2Body"), href: "/explore" },
    { icon: Megaphone, title: t("welcome.step3"), body: t("welcome.step3Body"), href: "/players" },
  ];

  return (
    <section className="card relative p-5" aria-labelledby="welcome-title">
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("common.close")}
        className="absolute right-3 top-3 rounded-full p-1.5 text-ink/60 hover:bg-cream-warm"
      >
        <X size={18} />
      </button>
      <h2 id="welcome-title" className="pr-8 text-lg font-bold">
        {t("welcome.title")}
      </h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {steps.map(({ icon: Icon, title, body, href }, i) => (
          <li key={href}>
            <Link href={href} onClick={dismiss} className="flex h-full gap-3 rounded-xl bg-cream-warm/70 p-3 hover:bg-cream-warm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-deep text-sm font-bold text-white">
                {i + 1}
              </span>
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon size={15} className="text-orange-dark" aria-hidden /> {title}
                </span>
                <span className="mt-0.5 block text-xs text-ink/70">{body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
