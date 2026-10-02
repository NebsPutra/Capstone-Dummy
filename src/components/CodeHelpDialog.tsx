"use client";

import { useEffect, useRef } from "react";
import { Inbox, MailWarning, AtSign, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { ResendButton } from "./AuthShell";

/**
 * "Didn't get the code?" pop-up for the email-code step. A full inbox can't be
 * detected by the app: the mail provider accepts the email and only bounces it
 * later, so Supabase reports success. Instead this explains the likely causes
 * (full inbox first) with Resend and Use another email right there.
 */
export function CodeHelpDialog({
  open,
  onClose,
  email,
  resendSeconds,
  resending,
  onResend,
  onUseAnotherEmail,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  resendSeconds: number;
  resending: boolean;
  onResend: () => void;
  onUseAnotherEmail: () => void;
}) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const tips = [
    { icon: Inbox, text: t("auth.help.full") },
    { icon: MailWarning, text: t("auth.help.spam") },
    { icon: AtSign, text: t("auth.help.address", { email }) },
  ];

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="code-help-title"
      className="w-[min(28rem,calc(100%-2rem))] rounded-3xl bg-surface p-0 text-ink backdrop:bg-ink/40"
    >
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="code-help-title" className="text-lg font-bold">
            {t("auth.help.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="-mr-2 -mt-1 rounded-full p-2 text-ink/70 hover:bg-cream-warm"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-ink/70">{t("auth.help.intro")}</p>
        <ul className="space-y-3">
          {tips.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 text-sm">
              <Icon size={18} className="mt-0.5 shrink-0 text-orange-dark" aria-hidden />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
          <ResendButton seconds={resendSeconds} sending={resending} onResend={onResend} />
          <button
            type="button"
            onClick={() => {
              onClose();
              onUseAnotherEmail();
            }}
            className="text-sm font-medium text-ink/70 hover:text-ink"
          >
            {t("auth.useAnotherEmail")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
