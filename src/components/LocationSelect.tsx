"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import { getAllCities, getDistricts, getVillages, type WilayahItem } from "@/lib/wilayah";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export interface LocationValue {
  city: string;
  kecamatan: string;
  kelurahan: string;
}

type LoadState = "idle" | "loading" | "error";

export function LocationSelect({
  value,
  onChange,
}: {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
}) {
  const { t } = useLanguage();

  const [cities, setCities] = useState<WilayahItem[]>([]);
  const [districts, setDistricts] = useState<WilayahItem[]>([]);
  const [villages, setVillages] = useState<WilayahItem[]>([]);

  const [cityState, setCityState] = useState<LoadState>("loading");
  const [districtState, setDistrictState] = useState<LoadState>("idle");
  const [villageState, setVillageState] = useState<LoadState>("idle");

  const [cityId, setCityId] = useState<string | null>(null);
  const [districtId, setDistrictId] = useState<string | null>(null);

  function loadCities() {
    setCityState("loading");
    getAllCities()
      .then((list) => {
        setCities(list);
        setCityState("idle");
      })
      .catch(() => setCityState("error"));
  }

  useEffect(() => {
    loadCities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadDistricts(regencyId: string) {
    setDistrictState("loading");
    getDistricts(regencyId)
      .then((list) => {
        setDistricts(list);
        setDistrictState("idle");
      })
      .catch(() => setDistrictState("error"));
  }

  function loadVillages(distId: string) {
    setVillageState("loading");
    getVillages(distId)
      .then((list) => {
        setVillages(list);
        setVillageState("idle");
      })
      .catch(() => setVillageState("error"));
  }

  function handleCityChange(id: string) {
    const match = cities.find((c) => c.id === id);
    setCityId(id || null);
    setDistrictId(null);
    setDistricts([]);
    setVillages([]);
    setDistrictState("idle");
    setVillageState("idle");
    onChange({ city: match?.name ?? "", kecamatan: "", kelurahan: "" });
    if (id) loadDistricts(id);
  }

  function handleDistrictChange(id: string) {
    const match = districts.find((d) => d.id === id);
    setDistrictId(id || null);
    setVillages([]);
    setVillageState("idle");
    onChange({ ...value, kecamatan: match?.name ?? "", kelurahan: "" });
    if (id) loadVillages(id);
  }

  function handleVillageChange(id: string) {
    const match = villages.find((v) => v.id === id);
    onChange({ ...value, kelurahan: match?.name ?? "" });
  }

  const hasUnresolvedSavedValue =
    !cityId && (value.city || value.kecamatan || value.kelurahan);

  return (
    <div className="space-y-2">
      {hasUnresolvedSavedValue && (
        <p className="text-xs text-ink/50">
          Currently saved: {[value.city, value.kecamatan, value.kelurahan].filter(Boolean).join(", ")}
          {" — select below to change."}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RegionField
          label={t("register.city")}
          state={cityState}
          onRetry={loadCities}
          disabled={false}
          value={cityId ?? ""}
          onChange={handleCityChange}
          options={cities}
        />
        <RegionField
          label={t("register.kecamatan")}
          state={districtState}
          onRetry={() => cityId && loadDistricts(cityId)}
          disabled={!cityId}
          value={districtId ?? ""}
          onChange={handleDistrictChange}
          options={districts}
        />
        <RegionField
          label={t("register.kelurahan")}
          state={villageState}
          onRetry={() => districtId && loadVillages(districtId)}
          disabled={!districtId}
          value=""
          onChange={handleVillageChange}
          options={villages}
        />
      </div>
    </div>
  );
}

function RegionField({
  label,
  state,
  onRetry,
  disabled,
  value,
  onChange,
  options,
}: {
  label: string;
  state: LoadState;
  onRetry: () => void;
  disabled: boolean;
  value: string;
  onChange: (id: string) => void;
  options: WilayahItem[];
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>

      {state === "error" ? (
        <button
          type="button"
          onClick={onRetry}
          className="flex w-full items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600"
        >
          <span className="flex items-center gap-1.5">
            <AlertCircle size={14} /> Failed to load — tap to retry
          </span>
          <RotateCw size={14} />
        </button>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || state === "loading"}
          className="w-full rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-orange disabled:bg-cream-warm disabled:opacity-60"
        >
          <option value="">
            {disabled ? "—" : state === "loading" ? "Loading..." : label}
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
