"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { inputClass } from "./ui";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="ambient-gradient flex min-h-screen items-center justify-center px-4 py-12">
      <div className={`w-full ${wide ? "max-w-xl" : "max-w-md"}`}>
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="mb-8 text-center">
          <Link href="/" className="text-xl font-extrabold text-orange-dark">
            Komunitas
          </Link>
          <h1 className="mt-4 text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink/60">{subtitle}</p>}
        </div>
        <div className="card p-6">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-ink/60">{footer}</div>}
      </div>
    </main>
  );
}

export function PasswordInput({
  id,
  value,
  onChange,
  hasError,
  autoComplete,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  hasError?: boolean;
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
}) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={hasError || undefined}
        className={`${inputClass(hasError)} pr-11`}
        placeholder="••••••••"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink/40 hover:text-ink/70"
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

/** Countdown for "Resend code" (Supabase allows one email per ~60s). */
export function useCooldown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);
  return { seconds, start: (s = 60) => setSeconds(s) };
}

export function ResendButton({
  seconds,
  sending,
  onResend,
}: {
  seconds: number;
  sending: boolean;
  onResend: () => void;
}) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={onResend}
      disabled={seconds > 0 || sending}
      className="text-sm font-medium text-orange-dark disabled:text-ink/40"
    >
      {sending
        ? t("auth.resending")
        : seconds > 0
        ? t("auth.resendIn", { s: seconds })
        : t("auth.resendCode")}
    </button>
  );
}
