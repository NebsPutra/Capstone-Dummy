"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Copy, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { Alert } from "./ui";

/**
 * Settings: a private calendar link (migration 027) that keeps every activity you
 * organize or join in Google/Apple Calendar. Anyone with the link can see those
 * activities, so it can be reset (the old link stops working).
 */
export function CalendarFeed() {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useLanguage();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);

  async function load(fn: "my_calendar_token" | "reset_calendar_token") {
    if (fn === "reset_calendar_token" && !window.confirm(t("calfeed.resetConfirm"))) return;
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc(fn);
    setBusy(false);
    if (rpcError) return setError(friendlyErrorKey(rpcError, fn));
    setUrl(`${window.location.origin}/api/calendar/${data as string}.ics`);
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card space-y-3 p-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <CalendarDays size={18} className="text-orange-dark" aria-hidden /> {t("calfeed.title")}
        </h2>
        <p className="text-sm text-ink/70">{t("calfeed.desc")}</p>
      </div>
      {url ? (
        <>
          <div className="flex gap-2">
            <input readOnly value={url} aria-label={t("calfeed.title")} className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-surface px-3 py-2 text-xs" />
            <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-full border border-ink/10 px-3 text-sm font-semibold hover:bg-cream-warm">
              <Copy size={14} aria-hidden /> {copied ? t("calfeed.copied") : t("calfeed.copy")}
            </button>
          </div>
          <ul className="space-y-1 text-sm text-ink/75">
            <li>
              <a href={url.replace(/^https?:/, "webcal:")} className="font-semibold text-orange-dark hover:underline">
                {t("calfeed.apple")}
              </a>
            </li>
            <li>{t("calfeed.google")}</li>
          </ul>
          <button
            type="button"
            onClick={() => load("reset_calendar_token")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/65 hover:text-danger disabled:opacity-60"
          >
            <RefreshCw size={13} aria-hidden /> {t("calfeed.reset")}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => load("my_calendar_token")}
          disabled={busy}
          className="rounded-full bg-orange-deep px-5 py-2 text-sm font-semibold text-white hover:bg-orange-deeper disabled:opacity-60"
        >
          {t("calfeed.get")}
        </button>
      )}
      {error && <Alert>{t(error)}</Alert>}
    </div>
  );
}
