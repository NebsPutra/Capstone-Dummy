"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, LocateFixed, RotateCw } from "lucide-react";
import {
  detectArea,
  getAllCities,
  getDistricts,
  getProvinces,
  getVillages,
  provinceIdOf,
  regionLabel,
  type WilayahItem,
} from "@/lib/wilayah";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { Combobox, type ComboOption } from "./Combobox";

/** Structured location: stable BPS ids + official names. Empty string = not selected. */
export interface LocationValue {
  provinceId: string;
  province: string;
  cityId: string;
  city: string;
  kecamatanId: string;
  kecamatan: string;
  kelurahanId: string;
  kelurahan: string;
}

export const EMPTY_LOCATION: LocationValue = {
  provinceId: "",
  province: "",
  cityId: "",
  city: "",
  kecamatanId: "",
  kecamatan: "",
  kelurahanId: "",
  kelurahan: "",
};

export interface LocationErrors {
  city?: string | null;
  kecamatan?: string | null;
  kelurahan?: string | null;
}

type Load<T> = { status: "idle" | "loading" | "error" | "ready"; items: T[] };
const idle = <T,>(): Load<T> => ({ status: "idle", items: [] });

/**
 * Province -> City/Regency -> Kecamatan -> Kelurahan/Desa, each a searchable
 * combobox limited to children of the level above. Province is optional:
 * the city search spans all of Indonesia and picking a city fills in its
 * province. Changing a level resets everything below it.
 *
 * Field ids are `${idPrefix}city` etc., so forms can scroll to the first
 * invalid one.
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
  const { t, lang } = useLanguage();

  const [provinces, setProvinces] = useState<Load<WilayahItem>>({ status: "loading", items: [] });
  const [cities, setCities] = useState<Load<WilayahItem>>({ status: "loading", items: [] });
  const [districts, setDistricts] = useState<Load<WilayahItem>>(idle);
  const [villages, setVillages] = useState<Load<WilayahItem>>(idle);
  const [reloadKey, setReloadKey] = useState(0);

  // Top-level lists (static; cached after the first visit).
  useEffect(() => {
    setProvinces({ status: "loading", items: [] });
    setCities({ status: "loading", items: [] });
    getProvinces()
      .then((items) => setProvinces({ status: "ready", items }))
      .catch(() => setProvinces({ status: "error", items: [] }));
    getAllCities()
      .then((items) => setCities({ status: "ready", items }))
      .catch(() => setCities({ status: "error", items: [] }));
  }, [reloadKey]);

  // Child lists follow the selected parent (also covers pre-filled values
  // and GPS-detected areas).
  useEffect(() => {
    if (!value.cityId) return setDistricts(idle());
    let cancelled = false;
    setDistricts({ status: "loading", items: [] });
    getDistricts(value.cityId)
      .then((items) => !cancelled && setDistricts({ status: "ready", items }))
      .catch(() => !cancelled && setDistricts({ status: "error", items: [] }));
    return () => {
      cancelled = true;
    };
  }, [value.cityId, reloadKey]);

  useEffect(() => {
    if (!value.kecamatanId) return setVillages(idle());
    let cancelled = false;
    setVillages({ status: "loading", items: [] });
    getVillages(value.kecamatanId)
      .then((items) => !cancelled && setVillages({ status: "ready", items }))
      .catch(() => !cancelled && setVillages({ status: "error", items: [] }));
    return () => {
      cancelled = true;
    };
  }, [value.kecamatanId, reloadKey]);

  // Profiles saved before provinces were stored: derive it from the city id.
  const provinceId = value.provinceId || (value.cityId ? provinceIdOf(value.cityId) : "");
  const provinceName = (id: string) => provinces.items.find((p) => p.id === id)?.name ?? "";

  const provinceOptions = useMemo<ComboOption[]>(
    () => provinces.items.map((p) => ({ id: p.id, label: p.name })),
    [provinces.items]
  );

  const cityOptions = useMemo<ComboOption[]>(
    () =>
      cities.items
        .filter((c) => !provinceId || provinceIdOf(c.id) === provinceId)
        .map((c) => ({
          id: c.id,
          label: regionLabel(c.name, lang),
          // Match on either language's form and on the province name.
          keywords: `${c.name} ${regionLabel(c.name, "en")} ${provinceName(provinceIdOf(c.id))}`,
          group: /^kota\s/i.test(c.name) ? 0 : 1,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cities.items, provinceId, lang, provinces.items]
  );

  const plainOptions = (items: WilayahItem[]): ComboOption[] => items.map((i) => ({ id: i.id, label: i.name }));

  function selectProvince(id: string) {
    // Keep the city only if it belongs to the newly chosen province.
    const keepCity = id && value.cityId && provinceIdOf(value.cityId) === id;
    onChange(
      keepCity
        ? { ...value, provinceId: id, province: provinceName(id) }
        : { ...EMPTY_LOCATION, provinceId: id, province: provinceName(id) }
    );
  }

  function selectCity(id: string) {
    const city = cities.items.find((c) => c.id === id);
    if (!city) {
      // Cleared: keep the province, reset everything below it.
      onChange({ ...EMPTY_LOCATION, provinceId: value.provinceId, province: value.province });
      return;
    }
    const pid = provinceIdOf(city.id);
    onChange({ ...EMPTY_LOCATION, provinceId: pid, province: provinceName(pid), cityId: city.id, city: city.name });
  }

  function selectKecamatan(id: string) {
    const d = districts.items.find((x) => x.id === id);
    onChange({ ...value, kecamatanId: d?.id ?? "", kecamatan: d?.name ?? "", kelurahanId: "", kelurahan: "" });
  }

  function selectKelurahan(id: string) {
    const v = villages.items.find((x) => x.id === id);
    onChange({ ...value, kelurahanId: v?.id ?? "", kelurahan: v?.name ?? "" });
  }

  // Legacy profiles saved names without ids; show them until re-selected.
  const legacyText =
    !value.cityId && (value.city || value.kecamatan || value.kelurahan)
      ? [value.kelurahan, value.kecamatan, value.city].filter(Boolean).join(", ")
      : null;

  const loadFailed = [provinces, cities, districts, villages].some((l) => l.status === "error");

  return (
    <div className="space-y-3">
      <GpsAssist
        onDetected={(area) =>
          onChange({
            provinceId: area.province?.id ?? "",
            province: area.province?.name ?? "",
            cityId: area.city?.id ?? "",
            city: area.city?.name ?? "",
            kecamatanId: area.kecamatan?.id ?? "",
            kecamatan: area.kecamatan?.name ?? "",
            kelurahanId: area.kelurahan?.id ?? "",
            kelurahan: area.kelurahan?.name ?? "",
          })
        }
      />

      {legacyText && (
        <p className="text-xs text-ink/50">{t("location.currentlySaved", { value: legacyText })}</p>
      )}

      {loadFailed && (
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-left text-sm text-red-600"
        >
          <span className="flex items-center gap-1.5">
            <AlertCircle size={14} className="shrink-0" /> {t("location.loadFailed")}
          </span>
          <RotateCw size={14} className="shrink-0" />
        </button>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Combobox
          id={`${idPrefix}province`}
          label={t("location.province")}
          placeholder={t("location.searchProvince")}
          options={provinceOptions}
          value={provinceId}
          onChange={selectProvince}
          loading={provinces.status === "loading"}
          noResults={t("location.noProvince")}
        />
        <Combobox
          id={`${idPrefix}city`}
          label={t("register.city")}
          placeholder={t("location.searchCity")}
          options={cityOptions}
          value={value.cityId}
          onChange={selectCity}
          loading={cities.status === "loading"}
          // Hundreds of cities nationwide: wait for 2 characters. Within one
          // province the list is short enough to show on open.
          minChars={provinceId ? 0 : 2}
          maxResults={provinceId ? 50 : 8}
          noResults={t("location.noCity")}
          error={errors?.city}
        />
        <Combobox
          id={`${idPrefix}kecamatan`}
          label={t("register.kecamatan")}
          placeholder={t("location.searchKecamatan")}
          options={plainOptions(districts.items)}
          value={value.kecamatanId}
          onChange={selectKecamatan}
          loading={districts.status === "loading"}
          disabled={!value.cityId}
          disabledHint={t("location.selectCityFirst")}
          noResults={t("location.noKecamatan")}
          error={errors?.kecamatan}
        />
        <Combobox
          id={`${idPrefix}kelurahan`}
          label={t("register.kelurahan")}
          placeholder={t("location.searchKelurahan")}
          options={plainOptions(villages.items)}
          value={value.kelurahanId}
          onChange={selectKelurahan}
          loading={villages.status === "loading"}
          disabled={!value.kecamatanId}
          disabledHint={t("location.selectKecamatanFirst")}
          noResults={t("location.noKelurahan")}
          error={errors?.kelurahan}
        />
      </div>
    </div>
  );
}

/**
 * Optional "Use my current location": reverse-geocodes GPS into suggested
 * Province/City/Kecamatan/Kelurahan. Hidden when location is blocked; the
 * user can always search and change the result manually.
 */
function GpsAssist({ onDetected }: { onDetected: (area: Awaited<ReturnType<typeof detectArea>>) => void }) {
  const { t } = useLanguage();
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ key: TranslationKey; tone: "info" | "error" } | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((s) => setAvailable(s.state !== "denied"))
      .catch(() => setAvailable(true));
    if (!navigator.permissions) setAvailable(true);
  }, []);

  if (!available) return null;

  function detect() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const area = await detectArea(pos.coords.latitude, pos.coords.longitude);
          if (!area.city) {
            setMessage({ key: "location.detectFailed", tone: "error" });
            if (area.province) onDetected(area);
          } else {
            onDetected(area);
            setMessage(area.kelurahan ? null : { key: "location.detectPartial", tone: "info" });
          }
        } catch (err) {
          console.error("[komunitas] detectArea:", err);
          setMessage({ key: "location.detectFailed", tone: "error" });
        } finally {
          setBusy(false);
        }
      },
      (err) => {
        setBusy(false);
        if (err.code === err.PERMISSION_DENIED) setAvailable(false);
        setMessage({ key: "location.detectFailed", tone: "error" });
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={detect}
        disabled={busy}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-orange/30 bg-orange/5 px-4 text-sm font-medium text-orange-dark hover:bg-orange/10 disabled:opacity-60 sm:min-h-0 sm:py-2"
      >
        <LocateFixed size={16} className={busy ? "animate-pulse" : ""} />
        {busy ? t("location.detecting") : t("location.useCurrent")}
      </button>
      {message && (
        <p className={`text-xs ${message.tone === "error" ? "text-red-600" : "text-ink/60"}`}>{t(message.key)}</p>
      )}
    </div>
  );
}
