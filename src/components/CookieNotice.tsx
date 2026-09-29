"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const KEY = "komunitas-cookie-notice";

/**
 * Komunitas only sets strictly necessary cookies/storage, which don't need
 * opt-in consent, so this is an information notice with a single
 * acknowledge button (no pre-ticked boxes or "accept all" pressure).
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
      aria-label={t("cookie.more")}
      className="fixed inset-x-3 bottom-20 z-[800] mx-auto max-w-xl animate-pop-in md:bottom-4"
    >
      <div className="card flex flex-col gap-3 p-4 shadow-lift sm:flex-row sm:items-center">
        <Cookie size={20} aria-hidden className="hidden shrink-0 text-orange-dark sm:block" />
        <p className="flex-1 text-sm text-ink/75">
          {t("cookie.text")}{" "}
          <Link href="/legal/cookies" className="font-semibold text-orange-dark underline">
            {t("cookie.more")}
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full bg-orange-deep px-5 py-2 text-sm font-semibold text-white hover:bg-orange-deeper"
        >
          {t("cookie.ok")}
        </button>
      </div>
    </div>
  );
}
