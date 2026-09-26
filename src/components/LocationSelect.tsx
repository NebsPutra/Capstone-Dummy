"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import { getAllCities, getDistricts, getVillages, type WilayahItem } from "@/lib/wilayah";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { inputClass } from "./ui";

/** Structured location: stable BPS ids + display names. Empty string = not selected. */
export interface LocationValue {
  cityId: string;
  city: string;
  kecamatanId: string;
  kecamatan: string;
  kelurahanId: string;
  kelurahan: string;
}

export const EMPTY_LOCATION: LocationValue = {
  cityId: "",
  city: "",
  kecamatanId: "",
  kecamatan: "",
  kelurahanId: "",
  kelurahan: "",
};

type LoadState = "idle" | "loading" | "error";

export interface LocationErrors {
  city?: string | null;
  kecamatan?: string | null;
  kelurahan?: string | null;
}

/**
 * Cascading City -> Kecamatan -> Kelurahan dropdowns. Each level only lists
 * children of the level above. Field ids are `${idPrefix}city` etc. so a
 * form can scroll to the first invalid one.
 */
export function LocationSelect({
  value,
  onChange,
  errors,
  idPrefix = "loc-",
}: {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  errors?: LocationErrors;
  idPrefix?: string;
}) {
  const { t } = useLanguage();

  const [cities, setCities] = useState<WilayahItem[]>([]);
  const [districts, setDistricts] = useState<WilayahItem[]>([]);
  const [villages, setVillages] = useState<WilayahItem[]>([]);

  const [cityState, setCityState] = useState<LoadState>("loading");
  const [districtState, setDistrictState] = useState<LoadState>("idle");
  const [villageState, setVillageState] = useState<LoadState>("idle");

  function loadCities() {
    setCityState("loading");
    getAllCities()
      .then((list) => {
        setCities(list);
        setCityState("idle");
      })
      .catch(() => setCityState("error"));
  }

  function loadDistricts(cityId: string) {
    setDistrictState("loading");
    getDistricts(cityId)
      .then((list) => {
        setDistricts(list);
        setDistrictState("idle");
      })
      .catch(() => setDistrictState("error"));
  }

  function loadVillages(kecamatanId: string) {
    setVillageState("loading");
    getVillages(kecamatanId)
      .then((list) => {
        setVillages(list);
        setVillageState("idle");
      })
      .catch(() => setVillageState("error"));
  }

  // Initial load, including the child lists for a pre-filled value (so a
  // saved profile location shows as selected instead of blank dropdowns).
  useEffect(() => {
    loadCities();
    if (value.cityId) loadDistricts(value.cityId);
    if (value.kecamatanId) loadVillages(value.kecamatanId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCityChange(id: string) {
    const match = cities.find((c) => c.id === id);
    setDistricts([]);
    setVillages([]);
    setVillageState("idle");
    onChange({ ...EMPTY_LOCATION, cityId: id, city: match?.name ?? "" });
    if (id) loadDistricts(id);
    else setDistrictState("idle");
  }

  function handleDistrictChange(id: string) {
    const match = districts.find((d) => d.id === id);
    setVillages([]);
    onChange({ ...value, kecamatanId: id, kecamatan: match?.name ?? "", kelurahanId: "", kelurahan: "" });
    if (id) loadVillages(id);
    else setVillageState("idle");
  }

  function handleVillageChange(id: string) {
    const match = villages.find((v) => v.id === id);
    onChange({ ...value, kelurahanId: id, kelurahan: match?.name ?? "" });
  }

  // Legacy profiles saved names without ids; show them until re-selected.
  const legacyText =
    !value.cityId && (value.city || value.kecamatan || value.kelurahan)
      ? [value.kelurahan, value.kecamatan, value.city].filter(Boolean).join(", ")
      : null;

  return (
    <div className="space-y-2">
      {legacyText && (
        <p className="text-xs text-ink/50">{t("location.currentlySaved", { value: legacyText })}</p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RegionField
          id={`${idPrefix}city`}
          label={t("register.city")}
          state={cityState}
          onRetry={loadCities}
          disabled={false}
          value={value.cityId}
          onChange={handleCityChange}
          options={cities}
          error={errors?.city}
        />
        <RegionField
          id={`${idPrefix}kecamatan`}
          label={t("register.kecamatan")}
          state={districtState}
          onRetry={() => value.cityId && loadDistricts(value.cityId)}
          disabled={!value.cityId}
          value={value.kecamatanId}
          onChange={handleDistrictChange}
          options={districts}
          error={errors?.kecamatan}
        />
        <RegionField
          id={`${idPrefix}kelurahan`}
          label={t("register.kelurahan")}
          state={villageState}
          onRetry={() => value.kecamatanId && loadVillages(value.kecamatanId)}
          disabled={!value.kecamatanId}
          value={value.kelurahanId}
          onChange={handleVillageChange}
          options={villages}
          error={errors?.kelurahan}
        />
      </div>
    </div>
  );
}

function RegionField({
  id,
  label,
  state,
  onRetry,
  disabled,
  value,
  onChange,
  options,
  error,
}: {
  id: string;
  label: string;
  state: LoadState;
  onRetry: () => void;
  disabled: boolean;
  value: string;
  onChange: (id: string) => void;
  options: WilayahItem[];
  error?: string | null;
}) {
  const { t } = useLanguage();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>

      {state === "error" ? (
        <button
          id={id}
          type="button"
          onClick={onRetry}
          className="flex w-full items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-left text-sm text-red-600"
        >
          <span className="flex items-center gap-1.5">
            <AlertCircle size={14} className="shrink-0" /> {t("location.loadFailed")}
          </span>
          <RotateCw size={14} className="shrink-0" />
        </button>
      ) : (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || state === "loading"}
          aria-invalid={Boolean(error) || undefined}
          className={inputClass(Boolean(error))}
        >
          <option value="">
            {disabled ? "—" : state === "loading" ? t("common.loading") : `${label}...`}
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
