"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * The link / QR point at /join/<share_token>, which resolves the event for
 * anyone signed in — including private events and people outside the
 * dashboard's 20 km radius. (Linking to /activities/<id> only worked for
 * public events.)
 */
export function ShareBox({
  shareToken,
  eventCode,
  title,
}: {
  shareToken: string;
  eventCode: string;
  title: string;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const path = `/join/${shareToken}`;
  const [url, setUrl] = useState(path);
  useEffect(() => setUrl(`${window.location.origin}${path}`), [path]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("[komunitas] clipboard:", err);
    }
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(t("share.message", { title, url }))}`;

  return (
    <div className="card space-y-4 p-5">
      <h2 className="text-sm font-semibold">{t("share.title")}</h2>
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink/60">
        <span className="rounded-full bg-cream-warm px-2.5 py-1">
          {t("share.code")}: <span className="font-semibold">{eventCode}</span>
        </span>
        <span className="rounded-full bg-cream-warm px-2.5 py-1 font-semibold">{shareToken}</span>
      </div>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="rounded-xl border border-ink/10 bg-white p-3">
          <QRCodeSVG value={url} size={120} />
        </div>
        <div className="w-full flex-1 space-y-2">
          <button
            onClick={copyLink}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-ink/10 py-2.5 text-sm font-medium hover:bg-cream-warm"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t("share.copied") : t("share.copyLink")}
          </button>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            {t("share.whatsapp")}
          </a>
          <p className="text-xs text-ink/50">{t("share.hint")}</p>
        </div>
      </div>
    </div>
  );
}
