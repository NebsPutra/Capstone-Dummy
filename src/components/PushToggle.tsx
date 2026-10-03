"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { currentSubscription, disablePush, enablePush, pushSupport, type PushSupport } from "@/lib/pushClient";

/** "Push notifications on this device" switch (Settings). Hidden when push isn't configured. */
export function PushToggle() {
  const { t, lang } = useLanguage();
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<TranslationKey | null>(null);

  useEffect(() => {
    const s = pushSupport();
    setSupport(s);
    if (s === "ok") currentSubscription().then((sub) => setOn(Boolean(sub)));
  }, []);

  if (!support || support === "off") return null;

  async function toggle() {
    setBusy(true);
    setNote(null);
    if (on) {
      await disablePush();
      setOn(false);
    } else {
      const result = await enablePush(lang);
      if (result === "ok") setOn(true);
      else setNote(result === "denied" ? "push.denied" : "push.error");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-1.5 rounded-xl bg-cream-warm p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{t("push.title")}</p>
          <p className="text-xs text-ink/70">{t("push.desc")}</p>
        </div>
        {support === "ok" && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={t("push.title")}
            disabled={busy}
            onClick={toggle}
            className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${on ? "bg-orange-deep" : "bg-ink/20"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
          </button>
        )}
      </div>
      {support === "needs-install" && <p className="text-xs text-ink/70">{t("push.needsInstall")}</p>}
      {support === "unsupported" && <p className="text-xs text-ink/70">{t("push.unsupported")}</p>}
      {note && <p className="text-xs text-danger">{t(note)}</p>}
    </div>
  );
}
