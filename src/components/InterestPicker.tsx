"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Interest } from "@/types";
import { FieldShell, inputClass } from "./ui";
import { TopicIcon } from "@/components/TopicIcon";
import { Check } from "lucide-react";

/** Multi-select hobby chips (registration + profile editing). */
export function InterestPicker({
  interests,
  selected,
  onToggle,
}: {
  interests: Interest[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const { td } = useLanguage();
  return (
    <div className="flex flex-wrap gap-2">
      {interests.map((i) => {
        const on = selected.includes(i.id);
        return (
          <button
            key={i.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(i.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
              on ? "border-orange bg-orange/10 text-orange-dark" : "border-ink/10 text-ink/70 hover:bg-cream-warm"
            }`}
          >
            {on ? <Check size={15} aria-hidden className="shrink-0" /> : <TopicIcon k={i.key} />} {td(`interest.${i.key}`, i.label)}
          </button>
        );
      })}
    </div>
  );
}

export function PrimaryInterestSelect({
  interests,
  selected,
  value,
  onChange,
  hasError,
}: {
  interests: Interest[];
  selected: string[];
  value: string;
  onChange: (v: string) => void;
  hasError?: boolean;
}) {
  const { t, td } = useLanguage();
  return (
    <div className="space-y-2">
      <FieldShell id="primary" label={t("register.primaryInterest")}>
        <select
          id="primary"
          value={value}
          disabled={selected.length === 0}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass(hasError)}
        >
          <option value="">{t("register.selectOne")}</option>
          {interests
            .filter((i) => selected.includes(i.id))
            .map((i) => (
              <option key={i.id} value={i.id}>
                {td(`interest.${i.key}`, i.label)}
              </option>
            ))}
        </select>
      </FieldShell>
      <p className="rounded-xl bg-cream-warm px-4 py-3 text-sm text-ink/70">{t("register.primaryExplain")}</p>
    </div>
  );
}
