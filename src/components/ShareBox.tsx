"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check } from "lucide-react";

export function ShareBox({
  eventId,
  shareToken,
  eventCode,
  title,
}: {
  eventId: string;
  shareToken: string;
  eventCode: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/activities/${eventId}`
      : `/activities/${eventId}`;

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    `Join "${title}" — ${url}`
  )}`;

  return (
    <div className="card space-y-4 p-5">
      <h3 className="text-sm font-semibold">Share this activity</h3>
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink/50">
        <span className="rounded-full bg-cream-warm px-2.5 py-1">Code: {eventCode}</span>
        <span className="rounded-full bg-cream-warm px-2.5 py-1">Token: {shareToken}</span>
      </div>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="rounded-xl border border-ink/10 p-3">
          <QRCodeSVG value={url} size={120} />
        </div>
        <div className="flex-1 space-y-2">
          <button
            onClick={copyLink}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-ink/10 py-2.5 text-sm font-medium hover:bg-cream-warm"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied!" : "Copy link"}
          </button>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Share via WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
