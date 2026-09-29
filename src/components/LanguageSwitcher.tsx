"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center rounded-full bg-cream-warm p-0.5 text-xs font-semibold">
      <button
        onClick={() => setLang("en")}
        className={`rounded-full px-2.5 py-1 transition ${
          lang === "en" ? "bg-orange-deep text-white" : "text-ink/65"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLang("id")}
        className={`rounded-full px-2.5 py-1 transition ${
          lang === "id" ? "bg-orange-deep text-white" : "text-ink/65"
        }`}
      >
        ID
      </button>
    </div>
  );
}
