"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { useToast } from "./Toast";
import { Alert, PrimaryButton } from "./ui";

/** "How was it?" after an activity: 1-5 stars and an optional comment (rate_event, migration 024). */
export function RatingForm({
  eventId,
  initial,
}: {
  eventId: string;
  initial: { rating: number; comment: string | null } | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();
  const { t } = useLanguage();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return setError("rating.pickStars");
    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("rate_event", { p_event: eventId, p_rating: rating, p_comment: comment });
    setSaving(false);
    if (rpcError) return setError(friendlyErrorKey(rpcError, "rate_event"));
    toast(t("rating.thanks"));
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card space-y-3 p-5">
      <h2 className="font-semibold">{initial ? t("rating.yours") : t("rating.title")}</h2>
      <fieldset>
        <legend className="sr-only">{t("rating.title")}</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer" title={t("rating.stars", { n })}>
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="peer sr-only"
              />
              <Star
                size={30}
                aria-hidden
                className={`transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-orange-dark ${
                  n <= rating ? "fill-orange text-orange" : "text-ink/30"
                }`}
              />
              <span className="sr-only">{t("rating.stars", { n })}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <textarea
        value={comment}
        maxLength={300}
        rows={2}
        placeholder={t("rating.commentPlaceholder")}
        aria-label={t("rating.commentPlaceholder")}
        onChange={(e) => setComment(e.target.value)}
        className="w-full rounded-xl border border-ink/10 bg-surface px-3 py-2 text-sm outline-none focus:border-orange"
      />
      {error && <Alert>{t(error)}</Alert>}
      <PrimaryButton type="submit" loading={saving} className="px-6 py-2.5">
        {initial ? t("rating.update") : t("rating.submit")}
      </PrimaryButton>
    </form>
  );
}
