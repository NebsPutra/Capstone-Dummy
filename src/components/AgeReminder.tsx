"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { AGE_MAX, AGE_MIN, isValidAge } from "@/lib/validation";
import { useToast } from "./Toast";
import { Alert, FieldShell, PrimaryButton, inputClass } from "./ui";

const DISMISS_KEY = "komunitas-age-reminder-dismissed";

function wasDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Dashboard popup asking users without an age to add one. "Later" hides it for this browser session. */
export function AgeReminder({ userId }: { userId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useLanguage();
  // Server snapshot "dismissed" keeps the portal out of SSR; the client reads sessionStorage.
  const dismissed = useSyncExternalStore(() => () => {}, wasDismissed, () => true);
  const [closed, setClosed] = useState(false);
  const [age, setAge] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);

  if (dismissed || closed) return null;

  function later() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setClosed(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const n = Number(age);
    if (!isValidAge(n)) return setError("profile.errAge");
    setSaving(true);
    setError(null);
    const { error: updateError } = await createClient().from("profiles").update({ age: n }).eq("id", userId);
    setSaving(false);
    if (updateError) return setError(friendlyErrorKey(updateError, "save age"));
    toast(t("ageReminder.saved"));
    setClosed(true);
    router.refresh();
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-reminder-title"
      className="fixed inset-0 z-[900] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      onClick={later}
    >
      <form
        onSubmit={save}
        className="card w-full max-w-sm space-y-4 rounded-b-none p-6 sm:rounded-b-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="age-reminder-title" className="text-lg font-semibold">
              {t("ageReminder.title")}
            </h2>
            <p className="mt-1 text-sm text-ink/70">{t("ageReminder.body")}</p>
          </div>
          <button type="button" onClick={later} aria-label={t("common.close")} className="text-ink/65">
            <X size={20} />
          </button>
        </div>

        <FieldShell id="reminder-age" label={t("profile.age")}>
          <input
            id="reminder-age"
            type="number"
            inputMode="numeric"
            min={AGE_MIN}
            max={AGE_MAX}
            autoFocus
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className={inputClass(Boolean(error))}
          />
        </FieldShell>

        {error && <Alert>{t(error)}</Alert>}

        <div className="flex gap-2">
          <button type="button" onClick={later} className="flex-1 rounded-full border border-ink/10 py-3 text-sm font-medium">
            {t("ageReminder.later")}
          </button>
          <PrimaryButton type="submit" className="flex-1" loading={saving}>
            {t("ageReminder.save")}
          </PrimaryButton>
        </div>
      </form>
    </div>,
    document.body
  );
}
