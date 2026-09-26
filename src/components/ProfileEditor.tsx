"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { BIO_MAX, normalizeWhatsapp } from "@/lib/validation";
import { geocodeArea } from "@/lib/wilayah";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { GENDERS, type Gender, type Interest, type Profile } from "@/types";
import { LocationSelect, type LocationValue } from "./LocationSelect";
import { InterestPicker, PrimaryInterestSelect } from "./InterestPicker";
import { useToast } from "./Toast";
import { Alert, FieldShell, PrimaryButton, focusFirstError, inputClass } from "./ui";

type Field =
  | "fullName"
  | "nickname"
  | "gender"
  | "whatsapp"
  | "city"
  | "kecamatan"
  | "kelurahan"
  | "bio"
  | "primary";
const FIELD_ORDER: Field[] = [
  "fullName",
  "nickname",
  "gender",
  "whatsapp",
  "city",
  "kecamatan",
  "kelurahan",
  "bio",
  "primary",
];

export function ProfileEditor({
  profile,
  allInterests,
  selectedInterestIds,
}: {
  profile: Profile;
  allInterests: Interest[];
  selectedInterestIds: string[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();
  const { t } = useLanguage();
  const busy = useRef(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [nickname, setNickname] = useState(profile.nickname ?? "");
  const [gender, setGender] = useState<Gender | "">(profile.gender ?? "");
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp_number ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [location, setLocation] = useState<LocationValue>({
    provinceId: profile.province_id ?? "",
    province: profile.province ?? "",
    cityId: profile.city_id ?? "",
    city: profile.city ?? "",
    kecamatanId: profile.kecamatan_id ?? "",
    kecamatan: profile.kecamatan ?? "",
    kelurahanId: profile.kelurahan_id ?? "",
    kelurahan: profile.kelurahan ?? "",
  });
  const [selected, setSelected] = useState<string[]>(selectedInterestIds);
  const [primary, setPrimary] = useState(profile.primary_interest_id ?? "");

  const [errors, setErrors] = useState<Partial<Record<Field, TranslationKey>>>({});
  const [formError, setFormError] = useState<TranslationKey | null>(null);

  function validate() {
    const e: typeof errors = {};
    if (!fullName.trim()) e.fullName = "register.errFullName";
    if (!nickname.trim()) e.nickname = "register.errNickname";
    if (!gender) e.gender = "register.errGender";
    if (!normalizeWhatsapp(whatsapp)) e.whatsapp = "register.errWhatsapp";
    // Legacy profiles saved area names only; keep them until the user
    // picks a structured location, then require all three levels.
    const legacyOnly = !location.cityId && Boolean(location.city);
    if (!legacyOnly) {
      if (!location.cityId) e.city = "register.errCity";
      else if (!location.kecamatanId) e.kecamatan = "register.errKecamatan";
      else if (!location.kelurahanId) e.kelurahan = "register.errKelurahan";
    }
    if (bio.length > BIO_MAX) e.bio = "register.errBioLong";
    else if (!bio.trim()) e.bio = "register.errBio";
    if (selected.length === 0) e.primary = "register.errInterests";
    else if (!primary || !selected.includes(primary)) e.primary = "register.errPrimary";
    return e;
  }

  async function handleSave() {
    if (busy.current) return; // double-submit protection
    setFormError(null);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFormError("register.fixErrors");
      focusFirstError(FIELD_ORDER, errs);
      return;
    }

    busy.current = true;
    setSaving(true);
    try {
      const locationChanged = Boolean(location.kelurahanId) && location.kelurahanId !== profile.kelurahan_id;
      const point = locationChanged
        ? await geocodeArea({ city: location.city, kecamatan: location.kecamatan, kelurahan: location.kelurahan })
        : null;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          nickname: nickname.trim(),
          gender: gender as Gender,
          whatsapp_number: normalizeWhatsapp(whatsapp)!,
          bio: bio.trim(),
          ...(location.cityId
            ? {
                province_id: location.provinceId || location.cityId.slice(0, 2),
                province: location.province || null,
                city_id: location.cityId,
                city: location.city,
                kecamatan_id: location.kecamatanId,
                kecamatan: location.kecamatan,
                kelurahan_id: location.kelurahanId,
                kelurahan: location.kelurahan,
              }
            : {}),
          ...(locationChanged ? { area_lat: point?.lat ?? null, area_lng: point?.lng ?? null } : {}),
        })
        .eq("id", profile.id);
      if (updateError) return setFormError(friendlyErrorKey(updateError, "update profile"));

      const { error: rpcError } = await supabase.rpc("set_user_interests", {
        p_interest_ids: selected,
        p_primary: primary,
      });
      if (rpcError) return setFormError(friendlyErrorKey(rpcError, "set_user_interests"));

      toast(t("profile.updated"));
      setEditing(false);
      router.refresh();
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full rounded-full border border-orange/30 bg-surface py-3 text-sm font-semibold text-orange-dark hover:bg-cream-warm"
      >
        {t("profile.editProfile")}
      </button>
    );
  }

  const err = (f: Field) => (errors[f] ? t(errors[f]!) : null);

  return (
    <div className="card space-y-5 p-6">
      <h2 className="font-semibold">{t("profile.editProfile")}</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldShell id="fullName" label={t("register.fullName")} error={err("fullName")}>
          <input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass(Boolean(errors.fullName))}
          />
        </FieldShell>
        <FieldShell id="nickname" label={t("register.nickname")} error={err("nickname")}>
          <input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className={inputClass(Boolean(errors.nickname))}
          />
        </FieldShell>
        <FieldShell id="gender" label={t("register.gender")} error={err("gender")}>
          <select
            id="gender"
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender | "")}
            className={inputClass(Boolean(errors.gender))}
          >
            <option value="">{t("register.genderSelect")}</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {t(`gender.${g}`)}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell id="whatsapp" label={t("register.whatsapp")} error={err("whatsapp")} hint={t("register.whatsappHint")}>
          <input
            id="whatsapp"
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className={inputClass(Boolean(errors.whatsapp))}
          />
        </FieldShell>
      </div>

      <LocationSelect
        value={location}
        onChange={setLocation}
        idPrefix=""
        errors={{ city: err("city"), kecamatan: err("kecamatan"), kelurahan: err("kelurahan") }}
      />

      <FieldShell
        id="bio"
        label={t("register.bio")}
        error={err("bio")}
        hint={
          <span className={bio.length > BIO_MAX ? "text-red-600" : ""}>
            {bio.length}/{BIO_MAX}
          </span>
        }
      >
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder={t("register.bioPlaceholder")}
          className={inputClass(Boolean(errors.bio))}
        />
      </FieldShell>

      <div className="space-y-3">
        <p className="text-sm font-medium">{t("profile.interests")}</p>
        <InterestPicker
          interests={allInterests}
          selected={selected}
          onToggle={(id) => {
            const next = selected.includes(id) ? selected.filter((i) => i !== id) : [...selected, id];
            setSelected(next);
            if (!next.includes(primary)) setPrimary("");
          }}
        />
        <PrimaryInterestSelect
          interests={allInterests}
          selected={selected}
          value={primary}
          onChange={setPrimary}
          hasError={Boolean(errors.primary)}
        />
        {errors.primary && <p className="text-xs text-red-600">{t(errors.primary)}</p>}
      </div>

      {formError && <Alert>{t(formError)}</Alert>}

      <div className="flex gap-2">
        <button
          onClick={() => setEditing(false)}
          disabled={saving}
          className="flex-1 rounded-full border border-ink/10 py-2.5 text-sm font-medium"
        >
          {t("profile.cancel")}
        </button>
        <PrimaryButton onClick={handleSave} loading={saving} loadingText={t("profile.saving")} className="flex-1 py-2.5">
          {t("profile.saveChanges")}
        </PrimaryButton>
      </div>
    </div>
  );
}
