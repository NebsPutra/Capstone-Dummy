// Theme constants usable from both server and client code (theme.tsx is
// a client module, so the server layout can't import helpers from it).

export type ThemePref = "light" | "dark" | "system";
export const THEME_COOKIE = "komunitas-theme";

export function isThemePref(v: unknown): v is ThemePref {
  return v === "light" || v === "dark" || v === "system";
}

/**
 * Runs before first paint (inlined in <head>) so there's no light flash for
 * dark-mode users. Kept as a string because it must not wait for React.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)/);var p=m?m[1]:'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
