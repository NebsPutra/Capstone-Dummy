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
import { weeklyDates } from "@/lib/events";
import type { Category, EventPrivacy, EventRecord, JoinPermission, SkillLevel } from "@/types";
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
export function ActivityForm({
  event,
  contactWhatsapp,
  fromRequest,
  groupId: initialGroupId,
  template,
}: {
  event?: EventRecord;
  /** The organizer's WhatsApp, stored in event_contacts (migration 016), when editing. */
  contactWhatsapp?: string | null;
  /** Creating from a "Find players" request: prefill, then close it and notify the interested players. */
  fromRequest?: { id: string; title: string; categoryId: string };
  /** Creating from a group page: preselect that group. */
  groupId?: string;
  /** "Duplicate": start a NEW activity from this one (everything except the date). */
  template?: EventRecord;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const { t, td, lang } = useLanguage();
  const busy = useRef(false);
  const isEdit = Boolean(event);
  // Field defaults: the activity being edited, or the one being duplicated.
  const src = event ?? template;

  const [categories, setCategories] = useState<Category[]>([]);

  const [title, setTitle] = useState(src?.title ?? fromRequest?.title ?? "");
  const [categoryId, setCategoryId] = useState(src?.category_id ?? fromRequest?.categoryId ?? "");
  const [description, setDescription] = useState(src?.description ?? "");
  const [date, setDate] = useState(event?.event_date ?? ""); // a duplicate needs a new date
  const [startTime, setStartTime] = useState(src?.start_time.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(src?.end_time.slice(0, 5) ?? "");
  const [maxParticipants, setMaxParticipants] = useState(String(src?.max_participants ?? 10));
  const [fee, setFee] = useState<number>(src ? toFee(src.fee) : 0);
  const [bannerUrl, setBannerUrl] = useState<string | null>(src?.banner_url ?? null);

  const [locationName, setLocationName] = useState(src?.location_name ?? "");
  const [address, setAddress] = useState(src?.address ?? "");
  // null = not pinned yet. The map must be pinned deliberately; previously an
  // un-pinned event was silently saved at the Jakarta fallback coordinates.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    src ? { lat: src.latitude, lng: src.longitude } : null
  );
  const [mapCenter, setMapCenter] = useState(src ? { lat: src.latitude, lng: src.longitude } : JAKARTA);
  const [locating, setLocating] = useState(false);

  const [picName, setPicName] = useState(src?.pic_name ?? "");
  const [picWhatsapp, setPicWhatsapp] = useState(contactWhatsapp ?? "");
  const [picInstructions, setPicInstructions] = useState(src?.pic_contact_instructions ?? "");
  const [whatsappPublic, setWhatsappPublic] = useState(src?.whatsapp_public ?? false);
  const [privacy, setPrivacy] = useState<EventPrivacy>(src?.privacy ?? "public");
  const [joinPermission, setJoinPermission] = useState<JoinPermission>(src?.join_permission ?? "open");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(src?.skill_level ?? "all");
  // New activities only: 1 = just once, otherwise weekly for that many weeks.
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  // Editing one date of a weekly series: also apply to its upcoming dates?
  const [applyToSeries, setApplyToSeries] = useState(false);
  // Groups the user belongs to (migration 019); an activity can belong to one.
  const [myGroups, setMyGroups] = useState<{ id: string; name: string }[]>([]);
  const [groupId, setGroupId] = useState(src?.group_id ?? initialGroupId ?? "");

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

    supabase.rpc("groups_list").then(({ data }) => {
      const mine = ((data ?? []) as { id: string; name: string; i_am_member: boolean }[]).filter((g) => g.i_am_member);
      setMyGroups(mine);
      // A ?group= link for a group you're not in: drop it instead of failing on save.
      setGroupId((id) => (id && !mine.some((g) => g.id === id) ? "" : id));
    });

    if (isEdit) return;
    // Pre-fill the PIC with the organizer's own details.
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("my_profile")
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
        pic_contact_instructions: picInstructions.trim() || null,
        whatsapp_public: whatsappPublic,
        privacy,
        join_permission: joinPermission,
        skill_level: skillLevel,
        group_id: groupId || null,
      };

      // The WhatsApp number lives in event_contacts, readable only by the
      // organizer, approved participants, or everyone when shown publicly.
      const saveContact = (eventId: string) =>
        supabase
          .from("event_contacts")
          .upsert({ event_id: eventId, pic_whatsapp: normalizeWhatsapp(picWhatsapp)! });

      if (event) {
        const { error } = await supabase.from("events").update(payload).eq("id", event.id);
        if (error) return setFormError(friendlyErrorKey(error, "update event"));
        const { error: contactError } = await saveContact(event.id);
        if (contactError) return setFormError(friendlyErrorKey(contactError, "save contact"));
        if (applyToSeries && event.series_id) {
          // Same changes for the series' other upcoming dates; each keeps its own date.
          const { event_date: _ownDate, ...shared } = payload;
          void _ownDate;
          const { data: others, error: seriesError } = await supabase
            .from("events")
            .update(shared)
            .eq("series_id", event.series_id)
            .neq("id", event.id)
            .neq("status", "cancelled")
            .gte("event_date", jakartaToday())
            .select("id");
          if (seriesError) return setFormError(friendlyErrorKey(seriesError, "update series"));
          await Promise.all((others ?? []).map((o) => saveContact(o.id)));
        }
        toast(t("edit.success"));
        router.push(`/activities/${event.id}`);
        router.refresh();
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return setFormError("err.NOT_AUTHENTICATED");
        // A weekly series is one row per date (own seats and participants),
        // linked by series_id (migration 017).
        const seriesId = repeatWeeks > 1 ? crypto.randomUUID() : null;
        const rows = weeklyDates(date, repeatWeeks).map((d) => ({
          ...payload,
          event_date: d,
          creator_id: user.id,
          ...(seriesId ? { series_id: seriesId } : {}),
        }));
        const { data: created, error } = await supabase.from("events").insert(rows).select("id, event_date");
        if (error || !created?.length) return setFormError(friendlyErrorKey(error, "create event"));
        const data = [...created].sort((x, y) => x.event_date.localeCompare(y.event_date));
        // The activities exist either way: on a contact error, say so and let the organizer fix it via Edit.
        const results = await Promise.all(data.map((row) => saveContact(row.id)));
        if (results.some((r) => r.error)) toast(t("create.contactFailed"), "error");
        else toast(t("create.success"));
        if (fromRequest) {
          await supabase.rpc("play_request_close", { p_request: fromRequest.id, p_event: data[0].id });
        }
        // ?created=1: the activity page opens with a "share it now" box.
        router.push(`/activities/${data[0].id}?created=1`);
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
        {isEdit && event?.series_id && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-ink/10 p-3 text-sm">
            <input
              type="checkbox"
              checked={applyToSeries}
              onChange={(e) => setApplyToSeries(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-orange"
            />
            <span>{t("edit.applyToSeries")}</span>
          </label>
        )}
        {!isEdit && (
          <FieldShell id="repeat" label={t("create.repeat")}>
            <select
              id="repeat"
              value={repeatWeeks}
              onChange={(e) => setRepeatWeeks(Number(e.target.value))}
              className={inputClass()}
            >
              <option value={1}>{t("create.repeatOnce")}</option>
              {[4, 8, 12].map((n) => (
                <option key={n} value={n}>
                  {t("create.repeatWeekly", { n })}
                </option>
              ))}
            </select>
          </FieldShell>
        )}
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
        {myGroups.length > 0 && (
          <FieldShell id="group" label={t("create.group")}>
            <select id="group" value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputClass()}>
              <option value="">{t("create.noGroup")}</option>
              {myGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </FieldShell>
        )}
        <RadioRow
          label={t("create.skillLevel")}
          name="skillLevel"
          options={[
            { value: "beginner", label: t("create.levelBeginner") },
            { value: "all", label: t("create.levelAll") },
            { value: "experienced", label: t("create.levelExperienced") },
          ]}
          value={skillLevel}
          onChange={(v) => setSkillLevel(v as SkillLevel)}
        />
      </Card>

      <Card title={t("banner.label")}>
        <BannerUpload
          value={bannerUrl}
          onChange={setBannerUrl}
          title={title || "…"}
          categoryKey={categories.find((c) => c.id === categoryId)?.key}
          date={date || null}
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
        <div id="map" tabIndex={-1} className={`rounded-xl outline-none ${errors.map ? "ring-2 ring-danger/60" : ""}`}>
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
          <p role="alert" className="text-xs text-danger">
            {errors.map}
          </p>
        ) : (
          <p className="text-xs text-ink/65">
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
        className={`h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-orange-deep" : "bg-ink/15"}`}
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
