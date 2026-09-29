"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { BUSINESS } from "@/lib/legal/documents";
import { Alert, inputClass } from "./ui";

const ERRORS: Record<string, TranslationKey> = {
  last_super_admin: "deleteAccount.lastSuperAdmin",
  unavailable: "deleteAccount.unavailable",
};

/** "Delete account" section for Profile → Security (calls /api/account/delete). */
export function DeleteAccount() {
  const { t } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const word = t("deleteAccount.word");
  const matches = typed.trim().toUpperCase() === word;

  async function remove() {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: typed }),
      });
      if (!res.ok) {
        const { error: code } = (await res.json().catch(() => ({}))) as { error?: string };
        setError(ERRORS[code ?? ""] ?? "deleteAccount.error");
        return;
      }
      router.replace("/?deleted=1");
      router.refresh();
    } catch {
      setError("deleteAccount.error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-4 border-red-200 p-5" aria-labelledby="delete-account-title">
      <div>
        <h2 id="delete-account-title" className="flex items-center gap-2 font-semibold text-red-700">
          <Trash2 size={18} aria-hidden /> {t("deleteAccount.title")}
        </h2>
        <p className="mt-1 text-sm text-ink/70">{t("deleteAccount.desc")}</p>
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          {t("deleteAccount.open")}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">{t("deleteAccount.listTitle")}</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">
              <li>{t("deleteAccount.item1")}</li>
              <li>{t("deleteAccount.item2")}</li>
              <li>{t("deleteAccount.item3")}</li>
              <li>{t("deleteAccount.item4")}</li>
            </ul>
          </div>
          <div>
            <label htmlFor="delete-confirm" className="mb-1 block text-sm font-medium">
              {t("deleteAccount.confirmLabel", { word })}
            </label>
            <input
              id="delete-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              className={inputClass()}
            />
          </div>
          {error && (
            <Alert>
              {t(error)}{" "}
              {error !== "deleteAccount.lastSuperAdmin" && (
                <a href={`mailto:${BUSINESS.email}`} className="font-semibold underline">
                  {BUSINESS.email}
                </a>
              )}
            </Alert>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={remove}
              disabled={!matches || busy}
              className="rounded-full bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? t("deleteAccount.deleting") : t("deleteAccount.confirm")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped("");
                setError(null);
              }}
              disabled={busy}
              className="rounded-full border border-ink/10 px-5 py-2.5 text-sm font-semibold hover:bg-cream-warm"
            >
              {t("deleteAccount.cancel")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
