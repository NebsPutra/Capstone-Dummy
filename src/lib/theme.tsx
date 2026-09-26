"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { THEME_COOKIE, type ThemePref } from "./theme-shared";

export type { ThemePref };

interface ThemeValue {
  pref: ThemePref;
  resolved: "light" | "dark";
  setPref: (p: ThemePref) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function systemIsDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ initialPref, children }: { initialPref: ThemePref; children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(initialPref);
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const apply = () => {
      const dark = pref === "dark" || (pref === "system" && systemIsDark());
      document.documentElement.classList.toggle("dark", dark);
      setResolved(dark ? "dark" : "light");
    };
    apply();
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [pref]);

  function setPref(p: ThemePref) {
    setPrefState(p);
    document.cookie = `${THEME_COOKIE}=${p}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  return <ThemeContext.Provider value={{ pref, resolved, setPref }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
