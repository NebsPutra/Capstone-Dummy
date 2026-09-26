"use client";

import { groupDigits, parseRupiahInput } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { inputClass } from "./ui";

/**
 * Fee entry. The value is always a whole-Rupiah number; the text shown is
 * just that number with thousand separators for the current language.
 *
 * This replaces a raw <input type="number">, which is what caused created
 * events to show a different fee than was typed: Indonesian users write
 * "25.000", and a number input reads the "." as a decimal point (25) or,
 * with a comma, rejects the value outright (stored as 0 → "Free").
 */
export function RupiahInput({
  id,
  value,
  onChange,
  hasError,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  hasError?: boolean;
}) {
  const { lang } = useLanguage();
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-ink/50">
        {lang === "id" ? "Rp" : "IDR"}
      </span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={value === 0 ? "0" : groupDigits(value, lang)}
        onChange={(e) => onChange(parseRupiahInput(e.target.value))}
        onFocus={(e) => e.target.select()}
        className={`${inputClass(hasError)} pl-12`}
      />
    </div>
  );
}
