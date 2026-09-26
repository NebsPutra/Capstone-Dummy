"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { geocodeArea } from "@/lib/wilayah";
import type { ManualArea } from "@/lib/location";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { EMPTY_LOCATION, LocationSelect, type LocationValue } from "./LocationSelect";
import { Alert, PrimaryButton } from "./ui";

/** Pick City/Kecamatan/Kelurahan and resolve it to an approximate point. */
export function ManualLocationDialog({
  onClose,
  onSelect,
  profileArea,
}: {
  onClose: () => void;
  onSelect: (area: ManualArea) => void;
  /** The user's registered area, offered as a one-tap option when available. */
  profileArea?: ManualArea | null;
}) {
  const { t } = useLanguage();
  const [value, setValue] = useState<LocationValue>(EMPTY_LOCATION);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUse() {
    if (!value.cityId || finding) return;
    setFinding(true);
    setError(null);
    const point = await geocodeArea({
      city: value.city,
      kecamatan: value.kecamatan || undefined,
      kelurahan: value.kelurahan || undefined,
    });
    setFinding(false);
    if (!point) {
      setError(t("location.geocodeFailed"));
      return;
    }
    onSelect({
      ...point,
      label: [value.kelurahan, value.kecamatan, value.city].filter(Boolean).join(", "),
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-location-title"
      className="fixed inset-0 z-[900] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg space-y-4 rounded-b-none p-6 sm:rounded-b-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="manual-location-title" className="text-lg font-semibold">
              {t("location.manualTitle")}
            </h2>
            <p className="mt-1 text-sm text-ink/60">{t("location.manualHint")}</p>
          </div>
          <button onClick={onClose} aria-label={t("common.close")} className="text-ink/50">
            <X size={20} />
          </button>
        </div>

        {profileArea && (
          <button
            type="button"
            onClick={() => onSelect(profileArea)}
            className="w-full rounded-xl border border-orange/30 bg-orange/5 px-4 py-3 text-left text-sm font-medium text-orange-dark hover:bg-orange/10"
          >
            {t("location.useProfileArea")} — {profileArea.label}
          </button>
        )}

        <LocationSelect value={value} onChange={setValue} idPrefix="manual-" />

        {error && <Alert>{error}</Alert>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-ink/10 py-3 text-sm font-medium"
          >
            {t("common.cancel")}
          </button>
          <PrimaryButton
            type="button"
            className="flex-1"
            disabled={!value.cityId}
            loading={finding}
            loadingText={t("location.finding")}
            onClick={handleUse}
          >
            {t("location.useThisArea")}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
