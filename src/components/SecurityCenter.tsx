"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Laptop, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { friendlyErrorKey, otpErrorKey } from "@/lib/errors";
import { isStrongPassword, isValidEmail, normalizeEmail } from "@/lib/validation";
import { deviceLabel } from "@/lib/device";
import { OtpInput, OTP_LENGTH } from "./OtpInput";
import { NewPinForm } from "./PinFields";
import { PasswordInput, ResendButton, useCooldown } from "./AuthShell";
import { Alert, FieldShell, PrimaryButton, inputClass } from "./ui";
import { useToast } from "./Toast";
import { DeleteAccount } from "./DeleteAccount";

export interface SecurityEventRow {
  id: number;
  type: string;
  device: string | null;
  created_at: string;
}

type SecurityNotice = "pin_changed" | "password_changed" | "email_changed" | "logout_all";

/** Tell the server to email the user about a change it has just recorded. */
function notify(event: SecurityNotice) {
  fetch("/api/security/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => {});
}

export function SecurityCenter({ email, pinSetAt, events }: { email: string; pinSetAt: string | null; events: SecurityEventRow[] }) {
  const { t, td, lang } = useLanguage();
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(lang === "id" ? "id-ID" : "en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }) + " WIB";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link href="/profile" className="inline-flex items-center gap-1 text-sm font-medium text-ink/70 hover:text-orange-dark">
          <ArrowLeft size={16} /> {t("security.backToProfile")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{t("security.title")}</h1>
        <p className="mt-1 text-sm text-ink/70">{t("security.subtitle")}</p>
      </div>

      <PinSection email={email} pinSetAt={pinSetAt} fmt={fmt} />
      <PasswordSection />
      <EmailSection email={email} />
      <SessionsSection />

      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck size={18} className="text-orange-dark" /> {t("security.activity")}
        </h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-ink/65">{t("security.noActivity")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/5">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5 text-sm">
                <span className={e.type === "pin_failed" || e.type === "pin_locked" ? "font-medium text-danger" : "font-medium"}>
                  {td(`security.event.${e.type}`, e.type)}
                </span>
                <span className="text-xs text-ink/65">
                  {e.device ? `${e.device} · ` : ""}
                  {fmt(e.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DeleteAccount />
    </div>
  );
}

function SectionHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 font-semibold">
        {icon} {title}
      </h2>
      {desc && <p className="mt-1 text-sm text-ink/70">{desc}</p>}
    </div>
  );
}

function PinSection({ email, pinSetAt, fmt }: { email: string; pinSetAt: string | null; fmt: (iso: string) => string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const [open, setOpen] = useState(!pinSetAt);

  return (
    <section className="card space-y-4 p-5">
      <SectionHeader
        icon={<LockKeyhole size={18} className="text-orange-dark" />}
        title={t("security.pinTitle")}
        desc={pinSetAt ? t("security.pinSetOn", { date: fmt(pinSetAt) }) : t("security.pinNotSet")}
      />
      {!open ? (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setOpen(true)} className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold hover:border-orange">
            {t("security.changePin")}
          </button>
          <Link href={`/forgot-pin?id=${encodeURIComponent(email)}&next=/profile/security`} className="text-sm font-medium text-orange-dark">
            {t("pinLogin.forgot")}
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-sm">
          <NewPinForm
            requireCurrent={Boolean(pinSetAt)}
            submitLabel={pinSetAt ? t("security.changePin") : t("pin.createSubmit")}
            onSubmit={async (pin, current) => {
              const { error } = await supabase.rpc("set_login_pin", pinSetAt ? { p_pin: pin, p_current: current } : { p_pin: pin });
              if (error) return friendlyErrorKey(error, "set_login_pin");
              if (pinSetAt) notify("pin_changed");
              toast(pinSetAt ? t("security.pinChanged") : t("security.pinCreated"));
              setOpen(false);
              router.refresh();
              return null;
            }}
          />
          {pinSetAt && (
            <button onClick={() => setOpen(false)} className="mt-3 w-full text-center text-sm font-medium text-ink/65">
              {t("common.cancel")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** Password change: a code emailed by Supabase (reauthentication) is required. */
function PasswordSection() {
  const { t } = useLanguage();
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const cooldown = useCooldown();
  const busy = useRef(false);
  const [stage, setStage] = useState<"idle" | "form">("idle");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);

  async function sendCode() {
    setError(null);
    const { error: e } = await supabase.auth.reauthenticate();
    if (e) {
      const key = friendlyErrorKey(e, "reauthenticate");
      setError(key === "err.generic" ? "auth.emailSendFailed" : key);
      return false;
    }
    cooldown.start();
    return true;
  }

  async function start() {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    if (await sendCode()) setStage("form");
    busy.current = false;
    setLoading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    setError(null);
    if (code.length !== OTP_LENGTH) return setError("auth.codeIncomplete");
    if (!isStrongPassword(password)) return setError("auth.passwordWeak");
    if (password !== confirm) return setError("auth.passwordMismatch");
    busy.current = true;
    setLoading(true);
    try {
      const { error: e2 } = await supabase.auth.updateUser({ password, nonce: code });
      if (e2) {
        if (e2.code === "same_password") return setError("security.pwSame");
        if (e2.code === "weak_password") return setError("auth.passwordWeak");
        if (/nonce|reauth/i.test(e2.message) || e2.code === "reauthentication_not_valid") return setError(otpErrorKey(e2));
        return setError(friendlyErrorKey(e2, "updateUser password"));
      }
      await supabase.rpc("record_security_event", { p_type: "password_changed", p_device: deviceLabel(navigator.userAgent) });
      notify("password_changed");
      toast(t("security.pwChanged"));
      setStage("idle");
      setCode("");
      setPassword("");
      setConfirm("");
      router.refresh();
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  return (
    <section className="card space-y-4 p-5">
      <SectionHeader icon={<KeyRound size={18} className="text-orange-dark" />} title={t("security.pwTitle")} desc={t("security.pwDesc")} />
      {stage === "idle" ? (
        <>
          {error && <Alert>{t(error)}</Alert>}
          <button onClick={start} disabled={loading} className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold hover:border-orange disabled:opacity-60">
            {loading ? t("auth.sending") : t("security.pwStart")}
          </button>
        </>
      ) : (
        <form onSubmit={submit} noValidate className="mx-auto max-w-sm space-y-4">
          <p className="text-center text-sm text-ink/70">{t("security.codeSentCurrent")}</p>
          <OtpInput id="pw-code" value={code} onChange={setCode} hasError={error === "auth.codeIncorrect" || error === "auth.codeExpired"} disabled={loading} />
          <div className="flex justify-center">
            <ResendButton seconds={cooldown.seconds} sending={false} onResend={sendCode} />
          </div>
          <FieldShell id="new-password" label={t("security.pwNew")} hint={t("auth.passwordRules")}>
            <PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" hasError={error === "auth.passwordWeak" || error === "security.pwSame"} />
          </FieldShell>
          <FieldShell id="confirm-password" label={t("auth.confirmPassword")}>
            <PasswordInput id="confirm-password" value={confirm} onChange={setConfirm} autoComplete="new-password" hasError={error === "auth.passwordMismatch"} />
          </FieldShell>
          {error && <Alert>{t(error)}</Alert>}
          <PrimaryButton type="submit" className="w-full" loading={loading} loadingText={t("pin.saving")}>
            {t("security.pwSave")}
          </PrimaryButton>
          <button type="button" onClick={() => setStage("idle")} className="w-full text-center text-sm font-medium text-ink/65">
            {t("common.cancel")}
          </button>
        </form>
      )}
    </section>
  );
}

/**
 * Email change: Supabase keeps the current address until the change is
 * confirmed with the code sent to the new address (and, with "Secure email
 * change" on, the code sent to the current one too).
 */
function EmailSection({ email }: { email: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const cooldown = useCooldown();
  const busy = useRef(false);
  const [stage, setStage] = useState<"idle" | "enter" | "verify">("idle");
  const [newEmail, setNewEmail] = useState("");
  const [codeNew, setCodeNew] = useState("");
  const [codeCurrent, setCodeCurrent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [info, setInfo] = useState<TranslationKey | null>(null);
  const clean = normalizeEmail(newEmail);

  async function request(): Promise<boolean> {
    const { error: e } = await supabase.auth.updateUser({ email: clean });
    if (e) {
      if (e.code === "email_exists" || /already/i.test(e.message)) setError("security.emailTaken");
      else setError(friendlyErrorKey(e, "updateUser email"));
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
    if (clean === normalizeEmail(email)) return setError("security.emailSame");
    busy.current = true;
    setLoading(true);
    if (await request()) {
      await supabase.rpc("record_security_event", { p_type: "email_change_requested", p_device: deviceLabel(navigator.userAgent) });
      setStage("verify");
    }
    busy.current = false;
    setLoading(false);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    setError(null);
    setInfo(null);
    if (codeNew.length !== OTP_LENGTH) return setError("auth.codeIncomplete");
    busy.current = true;
    setLoading(true);
    try {
      const { error: e1 } = await supabase.auth.verifyOtp({ email: clean, token: codeNew, type: "email_change" });
      if (e1) return setError(otpErrorKey(e1));
      if (codeCurrent.length === OTP_LENGTH) {
        const { error: e2 } = await supabase.auth.verifyOtp({ email, token: codeCurrent, type: "email_change" });
        if (e2) return setError(otpErrorKey(e2));
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (normalizeEmail(user?.email ?? "") !== clean) {
        setCodeNew("");
        return setInfo("security.emailOneMore");
      }
      await supabase.rpc("record_security_event", { p_type: "email_changed", p_device: deviceLabel(navigator.userAgent) });
      notify("email_changed");
      toast(t("security.emailChanged"));
      setStage("idle");
      router.refresh();
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  return (
    <section className="card space-y-4 p-5">
      <SectionHeader icon={<Mail size={18} className="text-orange-dark" />} title={t("security.emailTitle")} desc={t("security.emailCurrent", { email })} />
      {stage === "idle" && (
        <button onClick={() => setStage("enter")} className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold hover:border-orange">
          {t("security.emailStart")}
        </button>
      )}
      {stage === "enter" && (
        <form onSubmit={submitEmail} noValidate className="mx-auto max-w-sm space-y-4">
          <FieldShell id="new-email" label={t("security.emailNew")} error={error === "auth.emailInvalid" ? t(error) : null}>
            <input id="new-email" type="email" autoComplete="email" autoFocus value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")} className={inputClass(Boolean(error))} />
          </FieldShell>
          <p className="text-xs text-ink/65">{t("security.emailKeepNote")}</p>
          {error && error !== "auth.emailInvalid" && <Alert>{t(error)}</Alert>}
          <PrimaryButton type="submit" className="w-full" loading={loading} loadingText={t("auth.sending")}>
            {t("security.emailSend")}
          </PrimaryButton>
          <button type="button" onClick={() => setStage("idle")} className="w-full text-center text-sm font-medium text-ink/65">
            {t("common.cancel")}
          </button>
        </form>
      )}
      {stage === "verify" && (
        <form onSubmit={verify} noValidate className="mx-auto max-w-sm space-y-4">
          <div className="space-y-2">
            <p className="text-center text-sm font-medium">{t("security.codeForNew", { email: clean })}</p>
            <OtpInput id="code-new" value={codeNew} onChange={setCodeNew} hasError={Boolean(error)} disabled={loading} />
          </div>
          <div className="space-y-2">
            <p className="text-center text-sm font-medium">{t("security.codeForCurrent", { email })}</p>
            <OtpInput id="code-current" value={codeCurrent} onChange={setCodeCurrent} disabled={loading} />
            <p className="text-center text-xs text-ink/65">{t("security.codeForCurrentHint")}</p>
          </div>
          {info && !error && <Alert tone="info">{t(info)}</Alert>}
          {error && <Alert>{t(error)}</Alert>}
          <PrimaryButton type="submit" className="w-full" loading={loading} loadingText={t("auth.verifying")}>
            {t("security.emailConfirm")}
          </PrimaryButton>
          <div className="flex items-center justify-between">
            <ResendButton seconds={cooldown.seconds} sending={false} onResend={() => request()} />
            <button type="button" onClick={() => setStage("idle")} className="text-sm font-medium text-ink/65">
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function SessionsSection() {
  const { t } = useLanguage();
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const [device, setDevice] = useState("");
  const [busy, setBusy] = useState<"others" | "global" | null>(null);
  useEffect(() => setDevice(deviceLabel(navigator.userAgent)), []);

  async function signOutOthers() {
    setBusy("others");
    await supabase.rpc("record_security_event", { p_type: "logout_others", p_device: device });
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setBusy(null);
    toast(error ? t(friendlyErrorKey(error, "signOut others")) : t("security.loggedOutOthers"), error ? "error" : "success");
    router.refresh();
  }

  async function signOutEverywhere() {
    if (!window.confirm(t("security.logoutAllConfirm"))) return;
    setBusy("global");
    await supabase.rpc("record_security_event", { p_type: "logout_all", p_device: device });
    notify("logout_all");
    await supabase.auth.signOut({ scope: "global" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <section className="card space-y-4 p-5">
      <SectionHeader icon={<Laptop size={18} className="text-orange-dark" />} title={t("security.sessionsTitle")} desc={t("security.sessionsDesc")} />
      <div className="flex items-center justify-between gap-3 rounded-xl bg-cream-warm px-4 py-3 text-sm">
        <span className="font-medium">{device || "…"}</span>
        <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">{t("security.thisDevice")}</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={signOutOthers} disabled={busy !== null} className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold hover:border-orange disabled:opacity-60">
          {busy === "others" ? t("security.working") : t("security.logoutOthers")}
        </button>
        <button onClick={signOutEverywhere} disabled={busy !== null} className="rounded-full border border-danger/25 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger-soft disabled:opacity-60">
          {busy === "global" ? t("security.working") : t("security.logoutAll")}
        </button>
      </div>
    </section>
  );
}
