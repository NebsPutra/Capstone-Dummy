"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePref } from "@/lib/theme";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePref; icon: typeof Sun }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

/** Light / Dark / System. `compact` shows icons only (headers). */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { pref, setPref } = useTheme();
  const { t } = useLanguage();
  return (
    <div role="radiogroup" aria-label={t("theme.title")} className="flex items-center rounded-full bg-cream-warm p-0.5 text-xs font-semibold">
      {OPTIONS.map(({ value, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          title={t(`theme.${value}`)}
          onClick={() => setPref(value)}
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-1 transition",
            pref === value ? "bg-orange text-white shadow-soft" : "text-ink/50 hover:text-ink/80"
          )}
        >
          <Icon size={14} />
          {!compact && <span>{t(`theme.${value}`)}</span>}
        </button>
      ))}
    </div>
  );
}
