"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { friendlyErrorKey } from "@/lib/errors";
import { postLoginPath } from "@/lib/onboarding";
import { AuthShell, ResendButton, useCooldown } from "@/components/AuthShell";
import { OtpInput, OTP_LENGTH } from "@/components/OtpInput";
import { NewPinForm } from "@/components/PinFields";
import { Alert, FieldShell, PrimaryButton, inputClass } from "@/components/ui";

export default function ForgotPinPage() {
  return (
    <Suspense>
      <ForgotPin />
    </Suspense>
  );
}

type Step = "identify" | "code" | "pin";

/**
 * Forgot PIN (also "set up a PIN" for older accounts):
 *   1. Email or username → a 6-digit code is emailed to the verified address.
 *   2. The code signs the user in with a fresh email-code session.
 *   3. A new PIN is accepted only with that fresh session (checked in SQL).
 */
function ForgotPin() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const { t } = useLanguage();
  const cooldown = useCooldown();
  const busy = useRef(false);

  const [step, setStep] = useState<Step>("identify");
  const [identifier, setIdentifier] = useState(params.get("id") ?? "");
  const [masked, setMasked] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [info, setInfo] = useState<TranslationKey | null>(null);

  async function post(path: string, body: object) {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return (await res.json().catch(() => ({}))) as { ok?: boolean; masked?: string; reason?: string };
  }

  async function guard(fn: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      await fn();
    } catch {
      setError("err.network");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  async function sendCode(): Promise<boolean> {
    const r = await post("/api/auth/pin-recovery/start", { identifier: identifier.trim() });
    if (!r.ok) {
      setError(
        r.reason === "not_found" ? "forgotPin.notFound"
          : r.reason === "rate_limited" ? "auth.tooManyRequests"
          : r.reason === "unavailable" ? "pinLogin.unavailable"
          : "auth.emailSendFailed"
      );
      return false;
    }
    setMasked(r.masked ?? "");
    cooldown.start();
    return true;
  }

  function submitIdentifier(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!identifier.trim()) return setError("pinLogin.identifierRequired");
    guard(async () => {
      if (await sendCode()) setStep("code");
    });
  }

  function verify(token = code) {
    setError(null);
    if (token.length !== OTP_LENGTH) return setError("auth.codeIncomplete");
    guard(async () => {
      const r = await post("/api/auth/pin-recovery/verify", { identifier: identifier.trim(), code: token });
      if (!r.ok) {
        setCode("");
        return setError(r.reason === "expired" ? "auth.codeExpired" : r.reason === "rate_limited" ? "auth.tooManyRequests" : "auth.codeIncorrect");
      }
      setStep("pin");
    });
  }

  async function resend() {
    if (resending) return;
    setError(null);
    setResending(true);
    const ok = await sendCode();
    setResending(false);
    if (ok) setInfo("auth.codeResent");
  }

  async function savePin(pin: string): Promise<TranslationKey | null> {
    const { error: rpcError } = await supabase.rpc("set_login_pin", { p_pin: pin, p_current: null, p_recovery: true });
    if (rpcError) return friendlyErrorKey(rpcError, "set_login_pin");
    fetch("/api/security/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "pin_reset" }) }).catch(() => {});
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("my_profile")
      .select("role, onboarding_completed_at, full_name, nickname, whatsapp_number, gender, city_id, kecamatan_id, kelurahan_id, bio")
      .eq("id", user?.id ?? "")
      .maybeSingle();
    router.replace(postLoginPath(profile, params.get("next")));
    router.refresh();
    return null;
  }

  return (
    <AuthShell
      title={step === "pin" ? t("forgotPin.newTitle") : t("forgotPin.title")}
      subtitle={step === "identify" ? t("forgotPin.subtitle") : step === "pin" ? t("forgotPin.newHint") : undefined}
      footer={
        <Link href="/login" className="font-semibold text-orange-dark">
          {t("forgotPin.backToLogin")}
        </Link>
      }
    >
      {step === "identify" && (
        <form onSubmit={submitIdentifier} noValidate className="space-y-4">
          <FieldShell id="identifier" label={t("pinLogin.identifier")} error={error === "pinLogin.identifierRequired" ? t(error) : null}>
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={t("pinLogin.identifierPlaceholder")}
              className={inputClass(error === "pinLogin.identifierRequired" || error === "forgotPin.notFound")}
            />
          </FieldShell>
          {error && error !== "pinLogin.identifierRequired" && <Alert>{t(error)}</Alert>}
          <PrimaryButton type="submit" className="w-full" loading={loading} loadingText={t("forgotPin.sending")}>
            {t("forgotPin.sendCode")}
          </PrimaryButton>
        </form>
      )}

      {step === "code" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
          className="space-y-5"
        >
          <div className="text-center">
            <p className="font-semibold">{t("auth.codeSent")}</p>
            <p className="mt-1 text-sm text-ink/60">{t("auth.codeSentTo", { email: masked })}</p>
          </div>
          <OtpInput
            value={code}
            onChange={(v) => {
              setCode(v);
              if (error) setError(null);
            }}
            onComplete={(v) => verify(v)}
            hasError={Boolean(error)}
            disabled={loading}
          />
          {info && !error && <Alert tone="info">{t(info)}</Alert>}
          {error && <Alert>{t(error)}</Alert>}
          <PrimaryButton type="submit" className="w-full" loading={loading} loadingText={t("auth.verifying")}>
            {t("auth.verify")}
          </PrimaryButton>
          <div className="flex items-center justify-between">
            <ResendButton seconds={cooldown.seconds} sending={resending} onResend={resend} />
            <button type="button" onClick={() => setStep("identify")} className="text-sm font-medium text-ink/60">
              {t("forgotPin.changeAccount")}
            </button>
          </div>
          <p className="text-center text-xs text-ink/40">{t("auth.checkSpam")}</p>
        </form>
      )}

      {step === "pin" && <NewPinForm submitLabel={t("forgotPin.save")} onSubmit={savePin} />}
    </AuthShell>
  );
}
