"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const MapPicker = dynamic(() => import("@/components/MapPicker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center rounded-xl bg-cream-warm text-sm text-ink/40">
      Loading map...
    </div>
  ),
});

const DEFAULT_CENTER = { lat: -6.2088, lng: 106.8456 }; // Jakarta fallback

export default function CreateActivityPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Basic info
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("10");
  const [fee, setFee] = useState("0");

  // Location
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState(DEFAULT_CENTER);

  // PIC
  const [picName, setPicName] = useState("");
  const [picWhatsapp, setPicWhatsapp] = useState("");
  const [picInstructions, setPicInstructions] = useState("");
  const [whatsappPublic, setWhatsappPublic] = useState(false);

  // Privacy / join
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [joinPermission, setJoinPermission] = useState<"open" | "approval_required">("open");

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .then(({ data }) => setCategories(data ?? []));

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, [supabase]);

  function useMyLocation() {
    navigator.geolocation.getCurrentPosition((pos) =>
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!categoryId) return setError("Please select a category.");
    if (!date || !startTime || !endTime) return setError("Please set the date and time.");
    if (!locationName) return setError("Please provide a location name.");
    if (!picName || !picWhatsapp) return setError("Please provide organizer/PIC information.");

    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in.");
      setSubmitting(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("kelurahan")
      .eq("id", user.id)
      .single();

    const category = categories.find((c) => c.id === categoryId);

    const { data: codeData } = await supabase.rpc("generate_event_code", {
      category_key: category?.key ?? "GEN",
      kelurahan: profile?.kelurahan ?? "GEN",
    });
    const { data: tokenData } = await supabase.rpc("generate_share_token");

    const { data: inserted, error: insertError } = await supabase
      .from("events")
      .insert({
        event_code: codeData,
        share_token: tokenData,
        creator_id: user.id,
        category_id: categoryId,
        title,
        description,
        event_date: date,
        start_time: startTime,
        end_time: endTime,
        max_participants: Number(maxParticipants),
        fee: Number(fee) || 0,
        location_name: locationName,
        address,
        latitude: coords.lat,
        longitude: coords.lng,
        pic_name: picName,
        pic_whatsapp: picWhatsapp,
        pic_contact_instructions: picInstructions,
        whatsapp_public: whatsappPublic,
        privacy,
        join_permission: joinPermission,
      })
      .select()
      .single();

    if (insertError || !inserted) {
      setError(insertError?.message ?? "Could not create activity.");
      setSubmitting(false);
      return;
    }

    router.push(`/activities/${inserted.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("create.title")}</h1>
        <p className="mt-1 text-ink/60">{t("create.subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title={t("create.basicInfo")}>
          <TextField label={t("create.activityName")} value={title} onChange={setTitle} required />
          <div>
            <label className="mb-1 block text-sm font-medium">{t("create.category")}</label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-ink/10 px-4 py-2.5 text-sm outline-none focus:border-orange"
            >
              <option value="">{t("create.selectCategory")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("create.description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-ink/10 px-4 py-2.5 text-sm outline-none focus:border-orange"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <TextField label={t("create.date")} type="date" value={date} onChange={setDate} required />
            <TextField label={t("create.startTime")} type="time" value={startTime} onChange={setStartTime} required />
            <TextField label={t("create.endTime")} type="time" value={endTime} onChange={setEndTime} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t("create.maxParticipants")}
              type="number"
              value={maxParticipants}
              onChange={setMaxParticipants}
              required
            />
            <TextField
              label={t("create.fee")}
              type="number"
              value={fee}
              onChange={setFee}
            />
          </div>
        </Card>

        <Card title={t("create.location")}>
          <TextField label={t("create.locationName")} value={locationName} onChange={setLocationName} required />
          <TextField label={t("create.address")} value={address} onChange={setAddress} />
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{t("create.pickOnMap")}</label>
            <button
              type="button"
              onClick={useMyLocation}
              className="text-sm font-medium text-orange-dark"
            >
              {t("create.useMyLocation")}
            </button>
          </div>
          <MapPicker
            lat={coords.lat}
            lng={coords.lng}
            onChange={(lat, lng) => setCoords({ lat, lng })}
          />
          <p className="text-xs text-ink/40">
            Tap the map to drop the marker at the exact spot. {coords.lat.toFixed(5)},{" "}
            {coords.lng.toFixed(5)}
          </p>
        </Card>

        <Card title={t("create.organizerInfo")}>
          <TextField label={t("create.picName")} value={picName} onChange={setPicName} required />
          <TextField label={t("create.picWhatsapp")} value={picWhatsapp} onChange={setPicWhatsapp} required />
          <div>
            <label className="mb-1 block text-sm font-medium">{t("create.contactInstructions")}</label>
            <textarea
              value={picInstructions}
              onChange={(e) => setPicInstructions(e.target.value)}
              rows={2}
              placeholder="e.g. Please contact the PIC one day before the event to confirm attendance."
              className="w-full rounded-xl border border-ink/10 px-4 py-2.5 text-sm outline-none focus:border-orange"
            />
          </div>
          <Toggle
            label={t("create.showWhatsappPublicly")}
            checked={whatsappPublic}
            onChange={setWhatsappPublic}
          />
        </Card>

        <Card title={t("create.privacyJoin")}>
          <RadioRow
            label={t("create.visibility")}
            options={[
              { value: "public", label: t("create.public") },
              { value: "private", label: t("create.private") },
            ]}
            value={privacy}
            onChange={(v) => setPrivacy(v as "public" | "private")}
          />
          <RadioRow
            label={t("create.joinPermission")}
            options={[
              { value: "open", label: t("create.anyoneCanJoin") },
              { value: "approval_required", label: t("create.approvalRequired") },
            ]}
            value={joinPermission}
            onChange={(v) => setJoinPermission(v as "open" | "approval_required")}
          />
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-orange py-3.5 text-sm font-semibold text-white shadow-soft hover:bg-orange-dark disabled:opacity-60"
        >
          {submitting ? t("create.submitting") : t("create.submit")}
        </button>
      </form>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-4 p-6">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-ink/10 px-4 py-2.5 text-sm outline-none focus:border-orange"
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`h-6 w-11 rounded-full transition ${checked ? "bg-orange" : "bg-ink/15"}`}
      >
        <span
          className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white transition ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </label>
  );
}

function RadioRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="space-y-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm ${
              value === o.value ? "border-orange bg-orange/5" : "border-ink/10"
            }`}
          >
            <input
              type="radio"
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="mt-0.5 accent-orange"
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
