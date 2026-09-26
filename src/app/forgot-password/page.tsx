"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { friendlyErrorKey, otpErrorKey } from "@/lib/errors";
import { isStrongPassword, isValidEmail, normalizeEmail } from "@/lib/validation";
import { AuthShell, PasswordInput, ResendButton, useCooldown } from "@/components/AuthShell";
import { OtpInput, OTP_LENGTH } from "@/components/OtpInput";
import { useToast } from "@/components/Toast";
import { Alert, FieldShell, PrimaryButton, inputClass } from "@/components/ui";

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPassword />
    </Suspense>
  );
}

/** Email -> 6-digit recovery code + new password. */
function ForgotPassword() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const toast = useToast();
  const { t } = useLanguage();
  const cooldown = useCooldown();
  const busy = useRef(false);

  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [info, setInfo] = useState<TranslationKey | null>(null);

  const clean = normalizeEmail(email);

  async function sendCode(): Promise<boolean> {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(clean);
    if (resetError) {
      const key = friendlyErrorKey(resetError, "resetPasswordForEmail");
      setError(key === "err.generic" ? "auth.emailSendFailed" : key);
      return false;
    }
    cooldown.start();
    return true;
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    setError(null);
    if (!isValidEmail(clean)) return setError("auth.emailInvalid");
    busy.current = true;
    setLoading(true);
    try {
      const { data: status, error: rpcError } = await supabase.rpc("auth_email_status", {
        p_email: clean,
      });
      if (rpcError) return setError(friendlyErrorKey(rpcError, "auth_email_status"));
      if (status === "none") return setError("auth.accountNotFound");
      if (await sendCode()) setStep("reset");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    setError(null);
    setInfo(null);
    if (code.length !== OTP_LENGTH) return setError("auth.codeIncomplete");
    if (!isStrongPassword(password)) return setError("auth.passwordWeak");
    if (password !== confirm) return setError("auth.passwordMismatch");

    busy.current = true;
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: clean,
        token: code,
        type: "recovery",
      });
      if (verifyError) return setError(otpErrorKey(verifyError));

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        return setError(
          updateError.code === "same_password"
            ? "auth.samePassword"
            : updateError.code === "weak_password"
            ? "auth.passwordWeak"
            : friendlyErrorKey(updateError, "updateUser password")
        );
      }
      // Sign in again through the normal 3-step flow with the new password.
      await supabase.auth.signOut({ scope: "local" });
      toast(t("auth.resetSuccess"));
      router.replace(`/login?email=${encodeURIComponent(clean)}`);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  async function resend() {
    if (resending) return;
    setError(null);
    setResending(true);
    const ok = await sendCode();
    setResending(false);
    if (ok) setInfo("auth.codeResent");
  }

  return (
    <AuthShell
      title={t("auth.resetTitle")}
      subtitle={t("auth.resetSubtitle")}
      footer={
        <Link href="/login" className="font-semibold text-orange-dark">
          {t("auth.backToSignIn")}
        </Link>
      }
    >
      {step === "email" ? (
        <form onSubmit={submitEmail} noValidate className="space-y-4">
          <FieldShell id="email" label={t("auth.email")}>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              className={inputClass(Boolean(error))}
            />
          </FieldShell>
          {error && (
            <Alert>
              {t(error)}
              {error === "auth.accountNotFound" && (
                <>
                  {" "}
                  <Link href={`/register?email=${encodeURIComponent(clean)}`} className="font-semibold underline">
                    {t("auth.createInstead")}
                  </Link>
                </>
              )}
            </Alert>
          )}
          <PrimaryButton type="submit" className="w-full" loading={loading} loadingText={t("auth.sending")}>
            {t("auth.sendCode")}
          </PrimaryButton>
        </form>
      ) : (
        <form onSubmit={submitReset} noValidate className="space-y-4">
          <div className="text-center">
            <p className="font-semibold">{t("auth.codeSent")}</p>
            <p className="mt-1 text-sm text-ink/60">{t("auth.codeSentTo", { email: clean })}</p>
          </div>
          <OtpInput value={code} onChange={setCode} hasError={error === "auth.codeIncorrect"} disabled={loading} />
          <FieldShell id="new-password" label={t("auth.newPassword")} hint={t("auth.passwordRules")}>
            <PasswordInput
              id="new-password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              hasError={error === "auth.passwordWeak" || error === "auth.samePassword"}
            />
          </FieldShell>
          <FieldShell id="confirm" label={t("auth.confirmPassword")}>
            <PasswordInput
              id="confirm"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              hasError={error === "auth.passwordMismatch"}
            />
          </FieldShell>

          {info && !error && <Alert tone="info">{t(info)}</Alert>}
          {error && <Alert>{t(error)}</Alert>}

          <PrimaryButton type="submit" className="w-full" loading={loading} loadingText={t("auth.resetting")}>
            {t("auth.resetBtn")}
          </PrimaryButton>
          <div className="flex items-center justify-between">
            <ResendButton seconds={cooldown.seconds} sending={resending} onResend={resend} />
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
                setInfo(null);
              }}
              className="text-sm font-medium text-ink/60"
            >
              {t("auth.changeEmail")}
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
