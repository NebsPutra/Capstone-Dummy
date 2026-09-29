"use client";

import { useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { PIN_LENGTH, pinIssue } from "@/lib/pin";
import { OtpInput } from "./OtpInput";
import { Alert, PrimaryButton } from "./ui";

/**
 * Enter a new 6-digit PIN twice (and optionally the current one). Weak or
 * mismatched PINs are caught here for quick feedback; the database re-checks
 * everything. `onSubmit` returns an error key to show, or null on success.
 */
export function NewPinForm({
  onSubmit,
  submitLabel,
  requireCurrent,
}: {
  onSubmit: (pin: string, current: string) => Promise<TranslationKey | null>;
  submitLabel: string;
  requireCurrent?: boolean;
}) {
  const { t } = useLanguage();
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<TranslationKey | null>(null);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    setError(null);
    if (requireCurrent && current.length !== PIN_LENGTH) return setError("pin.errCurrentRequired");
    const issue = pinIssue(pin);
    if (issue) return setError(issue);
    if (confirm !== pin) return setError("pin.errMismatch");
    busy.current = true;
    setLoading(true);
    try {
      const err = await onSubmit(pin, current);
      if (err) {
        setError(err);
        if (err === "err.PIN_INCORRECT") setCurrent("");
        else if (err !== "err.PIN_LOCKED") {
          setPin("");
          setConfirm("");
        }
      }
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  const newPinError = error === "pin.errWeak" || error === "pin.errFormat" || error === "err.PIN_WEAK" || error === "err.PIN_SAME";
  return (
    <form onSubmit={submit} className="space-y-5">
      {requireCurrent && (
        <div className="space-y-2">
          <p className="text-center text-sm font-medium">{t("pin.current")}</p>
          <OtpInput id="pin-current" masked label={t("pin.current")} value={current} onChange={setCurrent}
            hasError={error === "err.PIN_INCORRECT" || error === "pin.errCurrentRequired"} disabled={loading} />
        </div>
      )}
      <div className="space-y-2">
        <p className="text-center text-sm font-medium">{t("pin.new")}</p>
        <OtpInput id="pin-new" masked label={t("pin.new")} value={pin} onChange={setPin} autoFocus={!requireCurrent}
          hasError={newPinError} disabled={loading} />
      </div>
      <div className="space-y-2">
        <p className="text-center text-sm font-medium">{t("pin.confirm")}</p>
        <OtpInput id="pin-confirm" masked label={t("pin.confirm")} value={confirm} onChange={setConfirm}
          hasError={error === "pin.errMismatch"} disabled={loading} />
      </div>
      <p className="text-center text-xs text-ink/65">{t("pin.rules")}</p>
      {error && <Alert>{t(error)}</Alert>}
      <PrimaryButton type="submit" className="w-full" loading={loading} loadingText={t("pin.saving")}>
        {submitLabel}
      </PrimaryButton>
    </form>
  );
}
