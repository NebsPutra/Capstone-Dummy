"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LANG_COOKIE,
  translate,
  translateDynamic,
  type Lang,
  type TranslateVars,
  type TranslationKey,
} from "./translations";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, vars?: TranslateVars) => string;
  /** For keys built from DB values, e.g. td(`category.${c.key}`, c.label) */
  td: (key: string, fallback: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * The language is persisted in a cookie (so Server Components render in the
 * right language on the first paint, with no English flash) and mirrored to
 * localStorage. The root layout resolves the initial value server-side.
 */
export function LanguageProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);

  function setLang(next: Lang) {
    setLangState(next);
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    document.documentElement.lang = next;
    try {
      window.localStorage.setItem(LANG_COOKIE, next);
    } catch {
      // storage unavailable (private mode) — the cookie is enough
    }
    // Re-render Server Components with the new language.
    router.refresh();
  }

  const value: LanguageContextValue = {
    lang,
    setLang,
    t: (key, vars) => translate(lang, key, vars),
    td: (key, fallback) => translateDynamic(lang, key, fallback),
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
