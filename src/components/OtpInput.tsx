"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export const OTP_LENGTH = 6;

/** Six single-digit boxes; supports paste and SMS/email autofill. */
export function OtpInput({
  value,
  onChange,
  onComplete,
  hasError,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  hasError?: boolean;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? "");

  function commit(next: string, focusIndex: number) {
    const clean = next.replace(/\D/g, "").slice(0, OTP_LENGTH);
    onChange(clean);
    refs.current[Math.min(focusIndex, OTP_LENGTH - 1)]?.focus();
    if (clean.length === OTP_LENGTH) onComplete?.(clean);
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label={t("auth.code")}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          id={i === 0 ? "otp" : undefined}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={t("auth.codeDigit", { n: i + 1 })}
          maxLength={OTP_LENGTH}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, "");
            if (!typed) return;
            // Pasting / autofill into any box fills from that position.
            const next = (value.slice(0, i) + typed).slice(0, OTP_LENGTH);
            commit(next, i + typed.length);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (digits[i]) {
                commit(value.slice(0, i) + value.slice(i + 1), i);
              } else if (i > 0) {
                commit(value.slice(0, i - 1) + value.slice(i), i - 1);
              }
            } else if (e.key === "ArrowLeft" && i > 0) {
              refs.current[i - 1]?.focus();
            } else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) {
              refs.current[i + 1]?.focus();
            }
          }}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-12 w-11 rounded-xl border bg-surface text-center text-lg font-semibold outline-none transition focus:border-orange sm:h-14 sm:w-12",
            hasError ? "border-red-400 bg-red-50/40" : "border-ink/10"
          )}
        />
      ))}
    </div>
  );
}
