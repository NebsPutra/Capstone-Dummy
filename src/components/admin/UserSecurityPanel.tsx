"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useToast } from "../Toast";
import { fmtDateTime, useRpc } from "./ui";

interface UserSecurity {
  pin_set: boolean;
  locked_until: string | null;
  failed_attempts: number;
  events: { type: string; device: string | null; created_at: string }[];
}

/**
 * PIN status + recent security events for one user. Admins can unlock a
 * locked PIN or clear it (the user then sets a new one through their email).
 * The PIN itself is never readable, not even here. Actions are audited.
 */
export function UserSecurityPanel({ userId, canManage }: { userId: string; canManage: boolean }) {
  const { t, td, lang } = useLanguage();
  const toast = useToast();
  const { data, reload } = useRpc<UserSecurity>("admin_user_security", { p_user: userId }, [userId]);
  const [busy, setBusy] = useState(false);

  async function act(action: "unlock" | "clear") {
    if (busy) return;
    if (action === "clear" && !window.confirm(t("asec.clearConfirm"))) return;
    setBusy(true);
    const { error } = await createClient().rpc("admin_pin_action", { p_user: userId, p_action: action });
    setBusy(false);
    if (error) return toast(t(friendlyErrorKey(error, "admin_pin_action")), "error");
    toast(action === "unlock" ? t("asec.unlocked") : t("asec.cleared"));
    reload();
  }

  if (!data) return <div className="skeleton h-40" />;
  return (
    <section className="card space-y-3 p-5 text-sm">
      <h2 className="font-semibold">{t("asec.title")}</h2>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <p>{t("asec.pin")}: <b>{data.pin_set ? t("asec.pinSet") : t("asec.pinNotSet")}</b></p>
        <p>
          {t("asec.status")}:{" "}
          <b className={data.locked_until ? "text-red-600" : ""}>
            {data.locked_until ? t("asec.lockedUntil", { time: fmtDateTime(data.locked_until, lang) }) : t("asec.notLocked")}
          </b>
        </p>
        <p>{t("asec.failed")}: <b>{data.failed_attempts}</b></p>
      </div>
      {canManage && data.pin_set && (
        <div className="flex flex-wrap gap-2">
          {data.locked_until && (
            <button disabled={busy} onClick={() => act("unlock")} className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">
              {t("asec.unlock")}
            </button>
          )}
          <button disabled={busy} onClick={() => act("clear")} className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600">
            {t("asec.clear")}
          </button>
        </div>
      )}
      <h3 className="pt-2 text-xs font-semibold uppercase text-ink/65">{t("asec.events")}</h3>
      {data.events.length === 0 ? (
        <p className="text-ink/65">—</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {data.events.map((e, i) => (
            <li key={i} className="flex flex-wrap gap-2">
              <time className="text-xs text-ink/65">{fmtDateTime(e.created_at, lang)}</time>
              <span className={e.type === "pin_failed" || e.type === "pin_locked" ? "font-medium text-red-600" : "font-medium"}>
                {td(`security.event.${e.type}`, e.type)}
              </span>
              {e.device && <span className="text-ink/65">{e.device}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
