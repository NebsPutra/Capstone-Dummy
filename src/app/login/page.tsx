"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, createEphemeralClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslateVars, TranslationKey } from "@/lib/i18n/translations";
import { friendlyErrorKey, otpErrorKey } from "@/lib/errors";
import { isValidEmail, normalizeEmail } from "@/lib/validation";
import { postLoginPath } from "@/lib/onboarding";
import { deviceLabel } from "@/lib/device";
import { AuthShell, PasswordInput, ResendButton, useCooldown } from "@/components/AuthShell";
import { OtpInput, OTP_LENGTH } from "@/components/OtpInput";
import { Alert, FieldShell, PrimaryButton, inputClass } from "@/components/ui";

type Step = "email" | "password" | "code";

export default function LoginPage() {
  return (
    <Suspense>
      <SignInSwitch />
    </Suspense>
  );
}

/** PIN sign-in is the default; email + password + email code stays available. */
function SignInSwitch() {
  const params = useSearchParams();
  const [mode, setMode] = useState<"pin" | "password">(params.get("mode") === "password" ? "password" : "pin");
  const [identifier, setIdentifier] = useState(params.get("email") ?? "");
  return mode === "pin" ? (
    <PinSignIn identifier={identifier} setIdentifier={setIdentifier} onUsePassword={() => setMode("password")} />
  ) : (
    <SignIn initialEmail={isValidEmail(normalizeEmail(identifier)) ? identifier : ""} onUsePin={() => setMode("pin")} />
  );
}

type PinReason = "invalid" | "no_pin" | "locked" | "rate_limited" | "suspended" | "unavailable" | "error";

/**
 * Sign in with email or username + 6-digit PIN. The PIN is checked on the
 * server (/api/auth/pin-login), which also enforces lockout and throttling.
 */
function PinSignIn({
  identifier,
  setIdentifier,
  onUsePassword,
}: {
  identifier: string;
  setIdentifier: (v: string) => void;
  onUsePassword: () => void;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { t, lang } = useLanguage();
  const busy = useRef(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ key: TranslationKey; vars?: TranslateVars; reason?: PinReason } | null>(null);

  async function submit(value = pin) {
    setError(null);
    if (!identifier.trim()) return setError({ key: "pinLogin.identifierRequired" });
    if (value.length !== OTP_LENGTH) return setError({ key: "pinLogin.pinIncomplete" });
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), pin: value, next: params.get("next") }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        next?: string;
        reason?: PinReason;
        remaining?: number;
        until?: string;
      };
      if (body.ok && body.next) {
        setDone(true);
        router.replace(body.next);
        router.refresh();
        return;
      }
      setPin("");
      const reason = body.reason ?? "error";
      if (reason === "invalid") {
        setError(
          body.remaining != null
            ? { key: "pinLogin.wrongRemaining", vars: { n: body.remaining }, reason }
            : { key: "pinLogin.wrong", reason }
        );
      } else if (reason === "locked") {
        const until = body.until
          ? new Date(body.until).toLocaleTimeString(lang === "id" ? "id-ID" : "en-GB", {
              timeZone: "Asia/Jakarta",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        setError({ key: "pinLogin.locked", vars: { time: `${until} WIB` }, reason });
      } else if (reason === "no_pin") setError({ key: "pinLogin.noPin", reason });
      else if (reason === "rate_limited") setError({ key: "auth.tooManyRequests", reason });
      else if (reason === "suspended") setError({ key: "pinLogin.suspended", reason });
      else if (reason === "unavailable") setError({ key: "pinLogin.unavailable", reason });
      else setError({ key: "err.generic", reason });
    } catch {
      setError({ key: "err.network" });
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  const forgotHref = `/forgot-pin${identifier.trim() ? `?id=${encodeURIComponent(identifier.trim())}` : ""}`;
  const identifierError = error?.key === "pinLogin.identifierRequired";

  return (
    <AuthShell
      title={t("auth.signInTitle")}
      subtitle={t("pinLogin.subtitle")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link href="/register" className="font-semibold text-orange-dark">
            {t("auth.signUp")}
          </Link>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
        className="space-y-5"
      >
        <FieldShell id="identifier" label={t("pinLogin.identifier")} error={identifierError ? t("pinLogin.identifierRequired") : null}>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus={!identifier}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={t("pinLogin.identifierPlaceholder")}
            className={inputClass(identifierError)}
          />
        </FieldShell>

        <div className="space-y-2">
          <p className="text-center text-sm font-medium">{t("pinLogin.pin")}</p>
          <OtpInput
            id="pin"
            masked
            label={t("pinLogin.pin")}
            value={pin}
            autoFocus={Boolean(identifier)}
            onChange={(v) => {
              setPin(v);
              if (error) setError(null);
            }}
            onComplete={(v) => submit(v)}
            hasError={Boolean(error) && !identifierError}
            disabled={loading || done}
          />
        </div>

        {done && <Alert tone="success">{t("auth.authSuccess")}</Alert>}
        {error && !identifierError && (
          <Alert>
            {t(error.key, error.vars)}
            {error.reason === "no_pin" && (
              <>
                {" "}
                <button type="button" onClick={onUsePassword} className="font-semibold underline">
                  {t("pinLogin.usePassword")}
                </button>
              </>
            )}
            {error.reason === "locked" && (
              <>
                {" "}
                <Link href={forgotHref} className="font-semibold underline">
                  {t("pinLogin.forgot")}
                </Link>
              </>
            )}
          </Alert>
        )}

        <PrimaryButton type="submit" className="w-full" loading={loading || done} loadingText={t("auth.signingIn")}>
          {t("auth.signIn")}
        </PrimaryButton>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link href={forgotHref} className="font-medium text-orange-dark">
            {t("pinLogin.forgot")}
          </Link>
          <button type="button" onClick={onUsePassword} className="font-medium text-ink/60 hover:text-ink">
            {t("pinLogin.usePassword")}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

/**
 * Sign In with password — three sessions:
 *   1. Email: check the account exists.
 *   2. Password: validated with Supabase Auth on a throwaway client, so no
 *      session exists yet.
 *   3. Email code: Supabase emails a 6-digit OTP; verifying it creates the
 *      real session. Only then is the user signed in.
 */
function SignIn({ initialEmail, onUsePin }: { initialEmail: string; onUsePin: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const { t } = useLanguage();
  const cooldown = useCooldown();
  const busy = useRef(false);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail);
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
      supabase
        .rpc("record_security_event", { p_type: "login_password", p_device: deviceLabel(navigator.userAgent) })
        .then(({ error: logError }) => {
          if (logError) console.error("[komunitas] record_security_event:", logError);
        });
      const { data: profile } = await supabase
        .from("my_profile")
        .select("role, onboarding_completed_at, full_name, nickname, whatsapp_number, gender, city_id, kecamatan_id, kelurahan_id, bio")
        .eq("id", data.user.id)
        .maybeSingle();

      router.replace(postLoginPath(profile, params.get("next")));
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
          <button type="button" onClick={onUsePin} className="w-full text-center text-sm font-medium text-ink/60 hover:text-ink">
            {t("pinLogin.usePin")}
          </button>
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
