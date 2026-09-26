"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, createEphemeralClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { friendlyErrorKey, otpErrorKey } from "@/lib/errors";
import { isValidEmail, normalizeEmail } from "@/lib/validation";
import { onboardingStep, safeNext } from "@/lib/onboarding";
import { AuthShell, PasswordInput, ResendButton, useCooldown } from "@/components/AuthShell";
import { OtpInput, OTP_LENGTH } from "@/components/OtpInput";
import { Alert, FieldShell, PrimaryButton, inputClass } from "@/components/ui";

type Step = "email" | "password" | "code";

export default function LoginPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}

/**
 * Sign In — three sessions:
 *   1. Email: check the account exists.
 *   2. Password: validated with Supabase Auth on a throwaway client, so no
 *      session exists yet.
 *   3. Email code: Supabase emails a 6-digit OTP; verifying it creates the
 *      real session. Only then is the user signed in.
 */
function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const { t } = useLanguage();
  const cooldown = useCooldown();
  const busy = useRef(false);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  // Unverified accounts verify with the sign-up code instead.
  const [codeKind, setCodeKind] = useState<"login" | "signup">("login");

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [info, setInfo] = useState<TranslationKey | null>(null);
  const [notFound, setNotFound] = useState(false);

  const cleanEmail = normalizeEmail(email);

  async function guard(fn: () => Promise<void>) {
    if (busy.current) return; // double-submit protection
    busy.current = true;
    setLoading(true);
    try {
      await fn();
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotFound(false);
    if (!isValidEmail(cleanEmail)) return setError("auth.emailInvalid");

    guard(async () => {
      const { data, error: rpcError } = await supabase.rpc("auth_email_status", {
        p_email: cleanEmail,
      });
      if (rpcError) return setError(friendlyErrorKey(rpcError, "auth_email_status"));
      if (data === "none") return setNotFound(true);
      setStep("password");
    });
  }

  async function sendLoginCode(): Promise<boolean> {
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { shouldCreateUser: false },
    });
    if (otpError) {
      const key = friendlyErrorKey(otpError, "signInWithOtp");
      setError(key === "err.generic" ? "auth.emailSendFailed" : key);
      return false;
    }
    cooldown.start();
    return true;
  }

  async function sendSignupCode(): Promise<boolean> {
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email: cleanEmail });
    if (resendError) {
      const key = friendlyErrorKey(resendError, "resend signup");
      setError(key === "err.generic" ? "auth.emailSendFailed" : key);
      return false;
    }
    cooldown.start();
    return true;
  }

  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!password) return setError("auth.passwordRequired");

    guard(async () => {
      const probe = createEphemeralClient();
      const { error: pwError } = await probe.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (pwError) {
        // Supabase checks the password before confirmation, so this code
        // means the password was right but the email was never verified.
        if (pwError.code === "email_not_confirmed") {
          if (await sendSignupCode()) {
            setCodeKind("signup");
            setInfo("auth.unconfirmedNotice");
            setStep("code");
          }
          return;
        }
        if (pwError.code === "invalid_credentials" || pwError.status === 400) {
          console.error("[komunitas] signInWithPassword:", pwError);
          return setError("auth.wrongCredentials");
        }
        return setError(friendlyErrorKey(pwError, "signInWithPassword"));
      }

      // Discard the probe session; the real one comes from the email code.
      await probe.auth.signOut({ scope: "local" }).catch(() => {});

      if (await sendLoginCode()) {
        setCodeKind("login");
        setStep("code");
      }
    });
  }

  function verify(token = code) {
    setError(null);
    if (token.length !== OTP_LENGTH) return setError("auth.codeIncomplete");

    guard(async () => {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token,
        type: "email",
      });
      if (verifyError || !data.user) {
        setError(otpErrorKey(verifyError));
        return; // stay on this step; the user can retry or resend
      }

      setInfo("auth.authSuccess");
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, onboarding_completed_at, full_name, nickname, whatsapp_number, gender, city_id, kecamatan_id, kelurahan_id, bio")
        .eq("id", data.user.id)
        .maybeSingle();

      const dest =
        onboardingStep(profile) !== "done"
          ? "/register?resume=1"
          : profile?.role === "admin"
          ? "/admin"
          : safeNext(params.get("next"));
      router.replace(dest);
      router.refresh();
    });
  }

  async function resend() {
    if (resending) return;
    setError(null);
    setInfo(null);
    setResending(true);
    const ok = codeKind === "signup" ? await sendSignupCode() : await sendLoginCode();
    setResending(false);
    if (ok) setInfo("auth.codeResent");
  }

  function changeEmail() {
    setStep("email");
    setPassword("");
    setCode("");
    setError(null);
    setInfo(null);
  }

  return (
    <AuthShell
      title={t("auth.signInTitle")}
      subtitle={t("auth.signInSubtitle")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link href="/register" className="font-semibold text-orange-dark">
            {t("auth.signUp")}
          </Link>
        </>
      }
    >
      {step === "email" && (
        <form onSubmit={submitEmail} noValidate className="space-y-4">
          <FieldShell id="email" label={t("auth.email")} error={error === "auth.emailInvalid" ? t(error) : null}>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setNotFound(false);
              }}
              placeholder={t("auth.emailPlaceholder")}
              className={inputClass(error === "auth.emailInvalid" || notFound)}
            />
          </FieldShell>

          {notFound && (
            <Alert>
              {t("auth.accountNotFound")}{" "}
              <Link
                href={`/register?email=${encodeURIComponent(cleanEmail)}`}
                className="font-semibold underline"
              >
                {t("auth.createInstead")}
              </Link>
            </Alert>
          )}
          {error && error !== "auth.emailInvalid" && <Alert>{t(error)}</Alert>}

          <PrimaryButton type="submit" className="w-full" loading={loading} loadingText={t("auth.checking")}>
            {t("auth.continue")}
          </PrimaryButton>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={submitPassword} noValidate className="space-y-4">
          <EmailSummary email={cleanEmail} onChange={changeEmail} />
          <FieldShell
            id="password"
            label={t("auth.password")}
            error={error === "auth.passwordRequired" ? t(error) : null}
          >
            <PasswordInput
              id="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              autoFocus
              hasError={error === "auth.wrongCredentials" || error === "auth.passwordRequired"}
            />
          </FieldShell>
          <div className="flex justify-end">
            <Link
              href={`/forgot-password?email=${encodeURIComponent(cleanEmail)}`}
              className="text-sm font-medium text-orange-dark"
            >
              {t("auth.forgotPassword")}
            </Link>
          </div>

          {error && error !== "auth.passwordRequired" && <Alert>{t(error)}</Alert>}

          <PrimaryButton type="submit" className="w-full" loading={loading} loadingText={t("auth.signingIn")}>
            {t("auth.continue")}
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
            <p className="mt-1 text-sm text-ink/60">{t("auth.codeSentTo", { email: cleanEmail })}</p>
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

          {info && !error && <Alert tone={info === "auth.authSuccess" ? "success" : "info"}>{t(info)}</Alert>}
          {error && <Alert>{t(error)}</Alert>}

          <PrimaryButton type="submit" className="w-full" loading={loading} loadingText={t("auth.verifying")}>
            {t("auth.verify")}
          </PrimaryButton>

          <div className="flex items-center justify-between">
            <ResendButton seconds={cooldown.seconds} sending={resending} onResend={resend} />
            <button type="button" onClick={changeEmail} className="text-sm font-medium text-ink/60">
              {t("auth.changeEmail")}
            </button>
          </div>
          <p className="text-center text-xs text-ink/40">{t("auth.checkSpam")}</p>
        </form>
      )}
    </AuthShell>
  );
}

function EmailSummary({ email, onChange }: { email: string; onChange: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-cream-warm px-4 py-2.5 text-sm">
      <span className="truncate font-medium">{email}</span>
      <button type="button" onClick={onChange} className="shrink-0 font-medium text-orange-dark">
        {t("auth.changeEmail")}
      </button>
    </div>
  );
}
