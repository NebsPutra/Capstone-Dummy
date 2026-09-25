"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Interest, Profile } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LocationSelect, type LocationValue } from "@/components/LocationSelect";

export function ProfileEditor({
  profile,
  allInterests,
}: {
  profile: Profile | null;
  allInterests: Interest[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp_number ?? "");
  const [location, setLocation] = useState<LocationValue>({
    city: profile?.city ?? "",
    kecamatan: profile?.kecamatan ?? "",
    kelurahan: profile?.kelurahan ?? "",
  });

  async function handleSave() {
    setSaving(true);
    await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        nickname,
        bio,
        whatsapp_number: whatsapp,
        kelurahan: location.kelurahan,
        kecamatan: location.kecamatan,
        city: location.city,
      })
      .eq("id", profile!.id);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full rounded-full border border-orange/30 bg-white py-3 text-sm font-semibold text-orange-dark hover:bg-cream-warm"
      >
        {t("profile.editProfile")}
      </button>
    );
  }

  return (
    <div className="card space-y-4 p-6">
      <h2 className="font-semibold">{t("profile.editProfile")}</h2>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t("register.fullName")} value={fullName} onChange={setFullName} />
        <Field label={t("register.nickname")} value={nickname} onChange={setNickname} />
        <Field label={t("register.whatsapp")} value={whatsapp} onChange={setWhatsapp} />
      </div>

      <LocationSelect value={location} onChange={setLocation} />

      <div>
        <label className="mb-1 block text-sm font-medium">{t("register.bio")}</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-ink/10 px-4 py-2.5 text-sm outline-none focus:border-orange"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setEditing(false)}
          className="flex-1 rounded-full border border-ink/10 py-2.5 text-sm font-medium"
        >
          {t("profile.cancel")}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-full bg-orange py-2.5 text-sm font-semibold text-white hover:bg-orange-dark disabled:opacity-60"
        >
          {saving ? t("profile.saving") : t("profile.saveChanges")}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-ink/10 px-4 py-2.5 text-sm outline-none focus:border-orange"
      />
    </div>
  );
}
