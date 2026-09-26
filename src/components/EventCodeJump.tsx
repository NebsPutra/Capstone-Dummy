"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * Open an activity by event code, share token or pasted invite link —
 * works for private and far-away events (no discovery restrictions).
 */
export function EventCodeJump() {
  const router = useRouter();
  const { t } = useLanguage();
  const [code, setCode] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = code.trim();
    if (!raw) return;
    // Accept a full invite URL (…/join/JOIN-XXXXXX) as well as a bare code.
    const fromUrl = raw.match(/\/(?:join|event\/code)\/([^/?#\s]+)/i)?.[1];
    const token = (fromUrl ?? raw).toUpperCase();
    router.push(`/event/code/${encodeURIComponent(token)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
      <label htmlFor="event-code" className="flex items-center gap-2 text-sm font-medium sm:w-72 sm:shrink-0">
        <Ticket size={18} className="shrink-0 text-orange-dark" />
        {t("code.haveCode")}
      </label>
      <div className="flex flex-1 gap-2">
        <input
          id="event-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("code.placeholder")}
          className="min-w-0 flex-1 rounded-full border border-ink/10 bg-surface px-4 py-2 text-sm outline-none focus:border-orange"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-orange px-5 py-2 text-sm font-semibold text-white hover:bg-orange-deep"
        >
          {t("code.open")}
        </button>
      </div>
    </form>
  );
}
