"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { IDLE_LIMIT_MS, WARN_BEFORE_MS } from "@/lib/session";
import { Modal } from "./ui";

const KEY = "kom-last-activity"; // shared by all open tabs
const PING_EVERY_MS = 4 * 60_000; // tells the server (proxy) the user is still active

function readShared(fallback: number) {
  try {
    return Math.max(fallback, Number(localStorage.getItem(KEY)) || 0);
  } catch {
    return fallback;
  }
}

/**
 * Client half of the session timeout: watches for activity in any tab, warns
 * a minute before 30 idle minutes, then signs out. The proxy enforces the same
 * limit on the server (closed tabs, sleeping laptops); see src/lib/session.ts.
 */
export function IdleTimeout() {
  const { t } = useLanguage();
  const last = useRef(0);
  const lastPing = useRef(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    last.current = Date.now();
    lastPing.current = Date.now();
    let leaving = false;

    const expire = async () => {
      if (leaving) return;
      leaving = true;
      await createClient().auth.signOut({ scope: "local" }).catch(() => {});
      // Full reload (not router.push) so no signed-in state survives in memory.
      location.replace(`/login?expired=idle&next=${encodeURIComponent(location.pathname + location.search)}`);
    };
    const ping = () => {
      lastPing.current = Date.now();
      fetch("/api/session/ping", { method: "POST", cache: "no-store" })
        .then((r) => {
          if (r.status === 401) void expire();
        })
        .catch(() => {});
    };
    const activity = () => {
      const now = Date.now();
      if (now - last.current < 5_000) return; // throttle
      last.current = now;
      try {
        localStorage.setItem(KEY, String(now));
      } catch {}
      if (now - lastPing.current > PING_EVERY_MS) ping();
    };
    const tick = () => {
      const idle = Date.now() - readShared(last.current);
      if (idle >= IDLE_LIMIT_MS) return void expire();
      setSecondsLeft(idle >= IDLE_LIMIT_MS - WARN_BEFORE_MS ? Math.ceil((IDLE_LIMIT_MS - idle) / 1000) : null);
    };

    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, activity, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", tick); // catch up after sleep or a hidden tab
    window.addEventListener("storage", tick); // another tab was active
    const id = setInterval(tick, 1_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, activity, { capture: true }));
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("storage", tick);
      clearInterval(id);
    };
  }, []);

  if (secondsLeft === null) return null;

  const stay = () => {
    const now = Date.now();
    last.current = now;
    try {
      localStorage.setItem(KEY, String(now));
    } catch {}
    lastPing.current = now;
    fetch("/api/session/ping", { method: "POST", cache: "no-store" }).catch(() => {});
    setSecondsLeft(null);
  };
  const signOutNow = async () => {
    await createClient().auth.signOut({ scope: "local" }).catch(() => {});
    location.replace("/login");
  };

  return (
    <Modal onClose={stay} labelledBy="idle-title" className="w-full max-w-sm rounded-t-3xl bg-surface p-6 shadow-lift sm:rounded-3xl">
      <h2 id="idle-title" className="text-lg font-bold">
        {t("idle.title")}
      </h2>
      <p className="mt-2 text-sm text-ink/70" aria-live="polite">
        {t("idle.body", { s: secondsLeft })}
      </p>
      <div className="mt-5 flex flex-col gap-2">
        <button type="button" data-autofocus onClick={stay} className="rounded-full bg-orange-dark py-3 text-sm font-semibold text-white hover:bg-orange-deep">
          {t("idle.stay")}
        </button>
        <button type="button" onClick={signOutNow} className="py-2 text-sm font-medium text-ink/65 hover:text-ink">
          {t("idle.signOut")}
        </button>
      </div>
    </Modal>
  );
}
