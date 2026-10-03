"use client";

import { useEffect, useState } from "react";
import { Share, Smartphone, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const KEY = "komunitas-install-dismissed";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * "Add Komunitas to your Home Screen" on phones. Android/Chrome: a real
 * Install button (beforeinstallprompt). iPhone/iPad Safari: short instructions
 * (needed there for push notifications). Hidden once installed or dismissed.
 */
export function InstallPrompt() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone || !window.matchMedia("(max-width: 767px)").matches) return;
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) setMode("ios");
    const onPrompt = (e: Event) => {
      e.preventDefault(); // show our own card instead of the browser's mini-bar
      setEvent(e as InstallEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!mode) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
    setMode(null);
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    dismiss();
  }

  return (
    <section className="card flex items-start gap-3 p-4">
      <Smartphone size={22} className="mt-0.5 shrink-0 text-orange-dark" aria-hidden />
      <div className="flex-1 space-y-2 text-sm">
        <p className="font-semibold">{t("install.title")}</p>
        {mode === "ios" ? (
          <p className="text-ink/75">
            {t("install.iosBefore")} <Share size={14} className="inline -translate-y-px" aria-label={t("install.share")} />{" "}
            {t("install.iosAfter")}
          </p>
        ) : (
          <>
            <p className="text-ink/75">{t("install.body")}</p>
            <button
              type="button"
              onClick={install}
              className="rounded-full bg-orange-deep px-4 py-1.5 font-semibold text-white hover:bg-orange-deeper"
            >
              {t("install.button")}
            </button>
          </>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label={t("common.close")} className="rounded-full p-1 text-ink/60 hover:bg-cream-warm">
        <X size={18} />
      </button>
    </section>
  );
}
