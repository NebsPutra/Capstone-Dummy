"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { LocateFixed } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { friendlyErrorKey } from "@/lib/errors";
import { FEE_MAX, MAX_PARTICIPANTS_LIMIT, normalizeWhatsapp } from "@/lib/validation";
import { formatFee, jakartaNowStamp, jakartaToday, toFee } from "@/lib/utils";
import type { Category, EventPrivacy, EventRecord, JoinPermission } from "@/types";
import { RupiahInput } from "./RupiahInput";
import { BannerUpload } from "./BannerUpload";
import { useToast } from "./Toast";
import { Alert, FieldShell, PrimaryButton, focusFirstError, inputClass } from "./ui";

const MapPicker = dynamic(() => import("@/components/MapPicker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="h-[280px] rounded-xl bg-cream-warm" />,
});

const JAKARTA = { lat: -6.2088, lng: 106.8456 };

type Field =
  | "title"
  | "category"
  | "date"
  | "startTime"
  | "endTime"
  | "maxParticipants"
  | "fee"
  | "locationName"
  | "map"
  | "picName"
  | "picWhatsapp";
const FIELD_ORDER: Field[] = [
  "title",
  "category",
  "date",
  "startTime",
  "endTime",
  "maxParticipants",
  "fee",
  "locationName",
  "map",
  "picName",
  "picWhatsapp",
];

/** Create + edit share one form. `event` switches it to edit mode. */
export function ActivityForm({ event }: { event?: EventRecord }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const { t, td, lang } = useLanguage();
  const busy = useRef(false);
  const isEdit = Boolean(event);

  const [categories, setCategories] = useState<Category[]>([]);

  const [title, setTitle] = useState(event?.title ?? "");
  const [categoryId, setCategoryId] = useState(event?.category_id ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [date, setDate] = useState(event?.event_date ?? "");
  const [startTime, setStartTime] = useState(event?.start_time.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(event?.end_time.slice(0, 5) ?? "");
  const [maxParticipants, setMaxParticipants] = useState(String(event?.max_participants ?? 10));
  const [fee, setFee] = useState<number>(event ? toFee(event.fee) : 0);
  const [bannerUrl, setBannerUrl] = useState<string | null>(event?.banner_url ?? null);

  const [locationName, setLocationName] = useState(event?.location_name ?? "");
  const [address, setAddress] = useState(event?.address ?? "");
  // null = not pinned yet. The map must be pinned deliberately; previously an
  // un-pinned event was silently saved at the Jakarta fallback coordinates.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    event ? { lat: event.latitude, lng: event.longitude } : null
  );
  const [mapCenter, setMapCenter] = useState(event ? { lat: event.latitude, lng: event.longitude } : JAKARTA);
  const [locating, setLocating] = useState(false);

  const [picName, setPicName] = useState(event?.pic_name ?? "");
  const [picWhatsapp, setPicWhatsapp] = useState(event?.pic_whatsapp ?? "");
  const [picInstructions, setPicInstructions] = useState(event?.pic_contact_instructions ?? "");
  const [whatsappPublic, setWhatsappPublic] = useState(event?.whatsapp_public ?? false);
  const [privacy, setPrivacy] = useState<EventPrivacy>(event?.privacy ?? "public");
  const [joinPermission, setJoinPermission] = useState<JoinPermission>(event?.join_permission ?? "open");

  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<TranslationKey | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .order("sort_order")
      // Inactive categories stay on existing events but can't be picked for new ones.
      .then(({ data }) =>
        setCategories((data ?? []).filter((c: Category & { is_active?: boolean }) => c.is_active !== false || c.id === event?.category_id))
      );

    if (isEdit) return;
    // Pre-fill the PIC with the organizer's own details.
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, nickname, whatsapp_number")
        .eq("id", user.id)
        .single();
      if (!profile) return;
      setPicName((v) => v || profile.full_name || profile.nickname || "");
      setPicWhatsapp((v) => v || profile.whatsapp_number || "");
    });

    // Center (and pin) on the user's position only if GPS was already
    // granted — don't trigger a permission prompt just by opening the form.
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((status) => {
        if (status.state !== "granted") return;
        navigator.geolocation.getCurrentPosition((pos) => {
          const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setMapCenter(here);
          setCoords((c) => c ?? here);
        });
      })
      .catch(() => {});
  }, [supabase, isEdit]);

  function pinMyLocation() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMapCenter(here);
        setCoords(here);
        clearError("map");
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast(t("location.gpsUnavailable"), "error");
      },
      { timeout: 15_000 }
    );
  }

  function clearError(field: Field) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(): Partial<Record<Field, string>> {
    const e: Partial<Record<Field, string>> = {};
    if (!title.trim()) e.title = t("create.errTitle");
    if (!categoryId) e.category = t("create.errCategory");
    if (!date) e.date = t("create.errDate");
    if (!startTime) e.startTime = t("create.errStart");
    if (!endTime) e.endTime = t("create.errEnd");
    if (startTime && endTime && endTime <= startTime) e.endTime = t("create.errEndBeforeStart");
    // Compare in Jakarta wall-clock time, the same frame the event is stored in.
    if (date && startTime && !e.startTime && `${date}T${startTime}` <= jakartaNowStamp()) {
      e.startTime = t("create.errPast");
    }

    const max = Number(maxParticipants);
    if (!Number.isInteger(max) || max < 1 || max > MAX_PARTICIPANTS_LIMIT) e.maxParticipants = t("create.errMax");
    else if (event && max < event.participant_count)
      e.maxParticipants = t("edit.errMaxBelowCount", { n: event.participant_count });

    if (fee < 0 || fee > FEE_MAX) e.fee = t("create.errFee");
    if (!locationName.trim()) e.locationName = t("create.errLocationName");
    if (!coords) e.map = t("create.errLocationPin");
    if (!picName.trim()) e.picName = t("create.errPicName");
    if (!normalizeWhatsapp(picWhatsapp)) e.picWhatsapp = t("create.errPicWhatsapp");
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return; // double-submit protection
    setFormError(null);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFormError("create.fixErrors");
      focusFirstError(FIELD_ORDER, errs);
      return;
    }

    busy.current = true;
    setSubmitting(true);
    try {
      // event_code, share_token, status and participant_count are set by
      // the database (events_before_write trigger), never by the client.
      const payload = {
        category_id: categoryId,
        title: title.trim(),
        description: description.trim() || null,
        banner_url: bannerUrl,
        event_date: date,
        start_time: startTime,
        end_time: endTime,
        max_participants: Number(maxParticipants),
        fee, // whole Rupiah as a number — never a formatted string
        location_name: locationName.trim(),
        address: address.trim() || null,
        latitude: coords!.lat,
        longitude: coords!.lng,
        pic_name: picName.trim(),
        pic_whatsapp: normalizeWhatsapp(picWhatsapp)!,
        pic_contact_instructions: picInstructions.trim() || null,
        whatsapp_public: whatsappPublic,
        privacy,
        join_permission: joinPermission,
      };

      if (event) {
        const { error } = await supabase.from("events").update(payload).eq("id", event.id);
        if (error) return setFormError(friendlyErrorKey(error, "update event"));
        toast(t("edit.success"));
        router.push(`/activities/${event.id}`);
        router.refresh();
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return setFormError("err.NOT_AUTHENTICATED");
        const { data, error } = await supabase
          .from("events")
          .insert({ ...payload, creator_id: user.id })
          .select("id")
          .single();
        if (error || !data) return setFormError(friendlyErrorKey(error, "create event"));
        toast(t("create.success"));
        router.push(`/activities/${data.id}`);
      }
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <Card title={t("create.basicInfo")}>
        <FieldShell id="title" label={t("create.activityName")} error={errors.title}>
          <input
            id="title"
            maxLength={120}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              clearError("title");
            }}
            className={inputClass(Boolean(errors.title))}
          />
        </FieldShell>
        <FieldShell id="category" label={t("create.category")} error={errors.category}>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              clearError("category");
            }}
            className={inputClass(Boolean(errors.category))}
          >
            <option value="">{t("create.selectCategory")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {td(`category.${c.key}`, c.label)}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell id="description" label={t("create.description")}>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={inputClass()}
          />
        </FieldShell>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FieldShell id="date" label={t("create.date")} error={errors.date}>
            <input
              id="date"
              type="date"
              min={jakartaToday()}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                clearError("date");
                clearError("startTime");
              }}
              className={inputClass(Boolean(errors.date))}
            />
          </FieldShell>
          <FieldShell id="startTime" label={t("create.startTime")} error={errors.startTime}>
            <input
              id="startTime"
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                clearError("startTime");
                clearError("endTime");
              }}
              className={inputClass(Boolean(errors.startTime))}
            />
          </FieldShell>
          <FieldShell id="endTime" label={t("create.endTime")} error={errors.endTime}>
            <input
              id="endTime"
              type="time"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                clearError("endTime");
              }}
              className={inputClass(Boolean(errors.endTime))}
            />
          </FieldShell>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldShell id="maxParticipants" label={t("create.maxParticipants")} error={errors.maxParticipants}>
            <input
              id="maxParticipants"
              inputMode="numeric"
              value={maxParticipants}
              onChange={(e) => {
                setMaxParticipants(e.target.value.replace(/\D/g, ""));
                clearError("maxParticipants");
              }}
              className={inputClass(Boolean(errors.maxParticipants))}
            />
          </FieldShell>
          <FieldShell
            id="fee"
            label={t("create.fee")}
            error={errors.fee}
            hint={t("create.feeHint", { fee: formatFee(fee, lang) })}
          >
            <RupiahInput
              id="fee"
              value={fee}
              onChange={(v) => {
                setFee(v);
                clearError("fee");
              }}
              hasError={Boolean(errors.fee)}
            />
          </FieldShell>
        </div>
      </Card>

      <Card title={t("banner.label")}>
        <BannerUpload
          value={bannerUrl}
          onChange={setBannerUrl}
          categoryKey={categories.find((c) => c.id === categoryId)?.key}
          emoji={categories.find((c) => c.id === categoryId)?.emoji}
          title={title || "…"}
        />
      </Card>

      <Card title={t("create.location")}>
        <FieldShell id="locationName" label={t("create.locationName")} error={errors.locationName}>
          <input
            id="locationName"
            value={locationName}
            onChange={(e) => {
              setLocationName(e.target.value);
              clearError("locationName");
            }}
            className={inputClass(Boolean(errors.locationName))}
          />
        </FieldShell>
        <FieldShell id="address" label={t("create.address")}>
          <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass()} />
        </FieldShell>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{t("create.pickOnMap")}</span>
          <button
            type="button"
            onClick={pinMyLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-dark disabled:opacity-60"
          >
            <LocateFixed size={15} />
            {locating ? t("location.locating") : t("create.useMyLocation")}
          </button>
        </div>
        <div id="map" tabIndex={-1} className={`rounded-xl outline-none ${errors.map ? "ring-2 ring-red-400" : ""}`}>
          <MapPicker
            center={mapCenter}
            marker={coords}
            onChange={(lat, lng) => {
              setCoords({ lat, lng });
              clearError("map");
            }}
          />
        </div>
        {errors.map ? (
          <p role="alert" className="text-xs text-red-600">
            {errors.map}
          </p>
        ) : (
          <p className="text-xs text-ink/40">
            {t("create.mapHint")}
            {coords && ` ${t("location.pinnedAt", { coords: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` })}`}
          </p>
        )}
      </Card>

      <Card title={t("create.organizerInfo")}>
        <FieldShell id="picName" label={t("create.picName")} error={errors.picName}>
          <input
            id="picName"
            value={picName}
            onChange={(e) => {
              setPicName(e.target.value);
              clearError("picName");
            }}
            className={inputClass(Boolean(errors.picName))}
          />
        </FieldShell>
        <FieldShell
          id="picWhatsapp"
          label={t("create.picWhatsapp")}
          error={errors.picWhatsapp}
          hint={t("register.whatsappHint")}
        >
          <input
            id="picWhatsapp"
            type="tel"
            inputMode="tel"
            value={picWhatsapp}
            onChange={(e) => {
              setPicWhatsapp(e.target.value);
              clearError("picWhatsapp");
            }}
            className={inputClass(Boolean(errors.picWhatsapp))}
          />
        </FieldShell>
        <FieldShell id="picInstructions" label={t("create.contactInstructions")}>
          <textarea
            id="picInstructions"
            value={picInstructions}
            onChange={(e) => setPicInstructions(e.target.value)}
            rows={2}
            placeholder={t("create.contactPlaceholder")}
            className={inputClass()}
          />
        </FieldShell>
        <Toggle label={t("create.showWhatsappPublicly")} checked={whatsappPublic} onChange={setWhatsappPublic} />
      </Card>

      <Card title={t("create.privacyJoin")}>
        <RadioRow
          label={t("create.visibility")}
          name="privacy"
          options={[
            { value: "public", label: t("create.public") },
            { value: "private", label: t("create.private") },
          ]}
          value={privacy}
          onChange={(v) => setPrivacy(v as EventPrivacy)}
        />
        <RadioRow
          label={t("create.joinPermission")}
          name="joinPermission"
          options={[
            { value: "open", label: t("create.anyoneCanJoin") },
            { value: "approval_required", label: t("create.approvalRequired") },
          ]}
          value={joinPermission}
          onChange={(v) => setJoinPermission(v as JoinPermission)}
        />
      </Card>

      {formError && <Alert>{t(formError)}</Alert>}

      <PrimaryButton
        type="submit"
        className="w-full py-3.5"
        loading={submitting}
        loadingText={isEdit ? t("edit.submitting") : t("create.submitting")}
      >
        {isEdit ? t("edit.submit") : t("create.submit")}
      </PrimaryButton>
    </form>
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
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-orange" : "bg-ink/15"}`}
      >
        <span
          className={`block h-5 w-5 translate-x-0.5 rounded-full bg-surface transition ${checked ? "translate-x-5" : ""}`}
        />
      </button>
    </div>
  );
}

function RadioRow({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
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
              name={name}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="mt-0.5 accent-orange"
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
