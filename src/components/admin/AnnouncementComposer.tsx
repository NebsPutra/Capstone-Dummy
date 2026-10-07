"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useToast } from "@/components/Toast";
import { Alert, FieldShell, Modal, PrimaryButton, inputClass } from "@/components/ui";

const LINKS = [
  ["/create", "announce.link.create"],
  ["/explore", "announce.link.explore"],
  ["/dashboard", "announce.link.dashboard"],
] as const;

/**
 * Admin form for one announcement to every active member (in-app, push and
 * email via send_announcement, migration 029). Sending needs a confirmation
 * that shows how many people will get it.
 */
export function AnnouncementComposer() {
  const { t } = useLanguage();
  const toast = useToast();
  const [title, setTitle] = useState(() => t("announce.defaultTitle"));
  const [body, setBody] = useState(() => t("announce.defaultBody"));
  const [link, setLink] = useState<string>("/create");
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = title.trim().length >= 3 && title.trim().length <= 80 && body.trim().length >= 10 && body.trim().length <= 500;

  function errorText(e: { message?: string }, fn: string) {
    if (e.message?.includes("TOO_SOON")) return t("announce.tooSoon");
    if (e.message?.includes("INVALID_INPUT")) return t("announce.invalid");
    return t(friendlyErrorKey(e, fn));
  }

  async function review() {
    setError(null);
    if (!valid) return setError(t("announce.invalid"));
    setBusy(true);
    const { data, error: e } = await createClient().rpc("announcement_recipient_count");
    setBusy(false);
    if (e) return setError(errorText(e, "announcement_recipient_count"));
    setCount(data as number);
  }

  async function send() {
    setBusy(true);
    const { data, error: e } = await createClient().rpc("send_announcement", { p_title: title, p_body: body, p_link: link });
    setBusy(false);
    setCount(null);
    if (e) return setError(errorText(e, "send_announcement"));
    toast(t("announce.sent", { n: String(data ?? 0) }));
  }

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">{t("announce.title")}</h2>
        <p className="mt-1 text-sm text-ink/70">{t("announce.desc")}</p>
      </div>
      {error && <Alert>{error}</Alert>}
      <FieldShell id="announce-title" label={t("announce.subject")}>
        <input id="announce-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className={inputClass()} />
      </FieldShell>
      <FieldShell id="announce-body" label={t("announce.body")} hint={t("announce.bodyHint")}>
        <textarea id="announce-body" value={body} maxLength={500} rows={6} onChange={(e) => setBody(e.target.value)} className={inputClass()} />
      </FieldShell>
      <FieldShell id="announce-link" label={t("announce.link")}>
        <select id="announce-link" value={link} onChange={(e) => setLink(e.target.value)} className={inputClass()}>
          {LINKS.map(([href, key]) => <option key={href} value={href}>{t(key)}</option>)}
        </select>
      </FieldShell>
      <div className="rounded-xl bg-cream-warm p-4 text-sm">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/65">{t("announce.preview")}</p>
        <p className="font-semibold text-orange-dark">{title.trim() || "…"}</p>
        {body.split(/\n+/).filter(Boolean).map((p, i) => <p key={i} className="mt-2 whitespace-pre-line">{p}</p>)}
      </div>
      <PrimaryButton onClick={review} loading={busy && count === null} disabled={!valid}>{t("announce.review")}</PrimaryButton>

      {count !== null && (
        <Modal onClose={() => !busy && setCount(null)} labelledBy="announce-confirm" className="w-full max-w-md rounded-t-3xl bg-surface p-6 sm:rounded-3xl">
          <h2 id="announce-confirm" className="text-lg font-semibold">{t("announce.confirmTitle", { n: String(count) })}</h2>
          <p className="mt-2 text-sm text-ink/70">{t("announce.confirmBody")}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setCount(null)} disabled={busy} className="rounded-full border border-ink/10 px-5 py-2.5 text-sm font-semibold">{t("announce.cancel")}</button>
            <PrimaryButton onClick={send} loading={busy} loadingText={t("announce.sending")} disabled={count === 0} data-autofocus>{t("announce.send")}</PrimaryButton>
          </div>
        </Modal>
      )}
    </section>
  );
}
