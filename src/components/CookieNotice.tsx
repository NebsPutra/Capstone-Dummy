"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const KEY = "komunitas-cookie-notice";

/**
 * Komunitas only sets strictly necessary cookies/storage, which don't need
 * opt-in consent, so this is an information notice with a single
 * acknowledge button (no pre-ticked boxes or "accept all" pressure). A
 * one-line strip, so it doesn't cover the page; the full explanation is on
 * the cookie policy page it links to. On phones it sits above the bottom nav
 * and the pinned Join bar.
 */
export function CookieNotice() {
  const { t } = useLanguage();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) setShow(true);
    } catch {
      // Storage blocked: nothing is stored anyway, so don't nag.
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

  return (
    <div
      role="region"
      aria-label={t("cookie.text")}
      className="fixed inset-x-3 bottom-40 z-[800] mx-auto w-fit max-w-[calc(100%-1.5rem)] animate-pop-in md:bottom-4"
    >
      <div className="flex items-center gap-2.5 rounded-full border border-ink/10 bg-surface py-1.5 pl-3.5 pr-1.5 text-xs shadow-lift">
        <Cookie size={15} aria-hidden className="shrink-0 text-orange-dark" />
        <p className="text-ink/80">
          {t("cookie.text")}{" "}
          <Link href="/legal/cookies" className="font-semibold text-orange-dark underline">
            {t("cookie.more")}
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full bg-orange-deep px-3.5 py-1.5 font-semibold text-white hover:bg-orange-deeper"
        >
          {t("cookie.ok")}
        </button>
      </div>
    </div>
  );
}
