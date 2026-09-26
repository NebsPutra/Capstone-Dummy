"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LocateFixed, MapPin, RefreshCw, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserLocation, type ManualArea, type UserLocation } from "@/lib/location";
import { effectiveStatus } from "@/lib/events";
import { categoryKeysFor, INTEREST_CATEGORY_KEYS } from "@/lib/interests";
import { friendlyErrorKey } from "@/lib/errors";
import { DASHBOARD_RADIUS_KM, distanceKm, eventStamp } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { EVENT_LIST_SELECT, type EventRecord } from "@/types";
import { ActivityCard } from "./ActivityCard";
import { EventCodeJump } from "./EventCodeJump";
import { ManualLocationDialog } from "./ManualLocationDialog";
import { Alert, PrimaryButton } from "./ui";

const SECTION_SIZE = 6;

/**
 * Dashboard sections, limited to public activities within 20 km of the
 * user's GPS position (or manually chosen area). The radius filter runs in
 * Postgres (nearby_events) with an indexed bounding box, so the browser
 * never downloads every event. Direct links / codes / QR are unaffected.
 */
export function NearbyDashboard({
  interestKeys,
  primaryInterestKey,
  profileArea,
}: {
  interestKeys: string[];
  primaryInterestKey: string | null;
  profileArea: ManualArea | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useLanguage();
  const { location, setManual, switchToGps } = useUserLocation({ autoPrompt: true });

  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const lat = location.status === "ready" ? location.lat : null;
  const lng = location.status === "ready" ? location.lng : null;

  const load = useCallback(async () => {
    if (lat === null || lng === null) return;
    setError(null);
    setEvents(null);
    const { data, error: rpcError } = await supabase
      .rpc("nearby_events", { p_lat: lat, p_lng: lng, p_radius_km: DASHBOARD_RADIUS_KM, p_limit: 100 })
      .select(EVENT_LIST_SELECT);
    if (rpcError) {
      setError(friendlyErrorKey(rpcError, "nearby_events"));
      return;
    }
    setEvents(
      ((data ?? []) as EventRecord[]).map((e) => ({
        ...e,
        distance_km: distanceKm(lat, lng, e.latitude, e.longitude),
      }))
    );
  }, [supabase, lat, lng]);

  useEffect(() => {
    load();
  }, [load]);

  const sections = useMemo(() => {
    if (!events) return null;
    const byDate = (a: EventRecord, b: EventRecord) =>
      eventStamp(a.event_date, a.start_time).localeCompare(eventStamp(b.event_date, b.start_time));

    const nearby = events.slice(0, SECTION_SIZE); // RPC returns nearest first
    const ongoing = events.filter((e) => effectiveStatus(e) === "ongoing");
    const upcoming = events
      .filter((e) => effectiveStatus(e) !== "ongoing")
      .sort(byDate)
      .slice(0, SECTION_SIZE);

    // Primary-interest matches rank above other-interest matches; within a
    // tier, sooner events first. Not a guarantee of placement.
    const primaryCats = new Set(primaryInterestKey ? INTEREST_CATEGORY_KEYS[primaryInterestKey] ?? [] : []);
    const anyCats = categoryKeysFor(interestKeys);
    const recommended = events
      .filter((e) => e.category && anyCats.has(e.category.key))
      .map((e) => ({ e, primary: primaryCats.has(e.category!.key) }))
      .sort((a, b) => Number(b.primary) - Number(a.primary) || byDate(a.e, b.e))
      .slice(0, SECTION_SIZE);

    return { nearby, ongoing, upcoming, recommended };
  }, [events, interestKeys, primaryInterestKey]);

  return (
    <div className="space-y-8">
      <LocationBar location={location} onManual={() => setDialogOpen(true)} onGps={switchToGps} />

      {location.status === "ready" && (
        <div className="space-y-1 text-sm text-ink/60">
          <p className="font-medium text-ink/80">{t("dashboard.radiusNote", { km: DASHBOARD_RADIUS_KM })}</p>
          <p>
            {t("dashboard.fartherNote")}{" "}
            <Link href="/explore" className="inline-flex items-center gap-1 font-semibold text-orange-dark">
              <Search size={14} /> {t("dashboard.searchLink")}
            </Link>
          </p>
        </div>
      )}

      <EventCodeJump />

      {location.status === "ready" &&
        (error ? (
          <div className="space-y-3">
            <Alert>{t(error)}</Alert>
            <button onClick={load} className="text-sm font-semibold text-orange-dark">
              {t("common.retry")}
            </button>
          </div>
        ) : !sections || !events ? (
          <p className="py-10 text-center text-sm text-ink/50">{t("dashboard.loading")}</p>
        ) : events.length === 0 ? (
          <div className="card space-y-4 p-8 text-center">
            <p className="text-ink/60">{t("dashboard.emptyNearby", { km: DASHBOARD_RADIUS_KM })}</p>
            <Link
              href="/create"
              className="inline-block rounded-full bg-orange px-6 py-3 text-sm font-semibold text-white hover:bg-orange-deep"
            >
              {t("dashboard.createCta")}
            </Link>
          </div>
        ) : (
          <>
            {sections.recommended.length > 0 && (
              <Section title={t("dashboard.recommended")}>
                {sections.recommended.map(({ e, primary }) => (
                  <ActivityCard
                    key={e.id}
                    event={e}
                    highlight={primary ? t("dashboard.primaryMatch") : undefined}
                  />
                ))}
              </Section>
            )}
            {sections.ongoing.length > 0 && (
              <Section title={t("dashboard.ongoing")}>
                {sections.ongoing.map((e) => (
                  <ActivityCard key={e.id} event={e} />
                ))}
              </Section>
            )}
            <Section title={t("dashboard.nearby")}>
              {sections.nearby.map((e) => (
                <ActivityCard key={e.id} event={e} />
              ))}
            </Section>
            {sections.upcoming.length > 0 && (
              <Section title={t("dashboard.upcoming")}>
                {sections.upcoming.map((e) => (
                  <ActivityCard key={e.id} event={e} />
                ))}
              </Section>
            )}
          </>
        ))}

      {dialogOpen && (
        <ManualLocationDialog
          profileArea={profileArea}
          onClose={() => setDialogOpen(false)}
          onSelect={(area) => {
            setManual(area);
            setDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

/** Current location source + controls; shared by dashboard and settings. */
export function LocationBar({
  location,
  onManual,
  onGps,
}: {
  location: UserLocation;
  onManual: () => void;
  onGps: () => void;
}) {
  const { t } = useLanguage();

  if (location.status === "checking" || location.status === "locating") {
    return (
      <div className="card flex items-center gap-3 p-4 text-sm text-ink/60">
        <LocateFixed size={18} className="animate-pulse text-orange-dark" />
        {t("location.locating")}
      </div>
    );
  }

  if (location.status === "unavailable") {
    return (
      <div className="card space-y-3 p-5">
        <div className="flex items-start gap-3">
          <MapPin size={20} className="mt-0.5 shrink-0 text-orange-dark" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">
              {location.reason === "not-asked" ? t("location.needLocation") : t("location.gpsUnavailable")}
            </p>
            {location.reason === "denied" && <p className="text-ink/60">{t("location.permissionDenied")}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrimaryButton onClick={onManual} className="px-5 py-2.5">
            {t("location.setManually")}
          </PrimaryButton>
          {location.reason !== "unsupported" && (
            <button
              onClick={onGps}
              className="rounded-full border border-ink/10 bg-surface px-5 py-2.5 text-sm font-medium hover:bg-cream-warm"
            >
              {location.reason === "not-asked" ? t("location.allowGps") : t("location.useGps")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <MapPin size={18} className="mt-0.5 shrink-0 text-orange-dark" />
        <div>
          <p className="font-medium">
            {location.source === "gps" ? t("location.usingGps") : t("location.usingManual")}
          </p>
          {location.source === "manual" && location.label && <p className="text-ink/50">{location.label}</p>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          onClick={onGps}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-surface px-3.5 py-1.5 font-medium hover:bg-cream-warm"
        >
          {location.source === "gps" ? <RefreshCw size={14} /> : <LocateFixed size={14} />}
          {location.source === "gps" ? t("location.refresh") : t("location.useGps")}
        </button>
        <button
          onClick={onManual}
          className="rounded-full border border-ink/10 bg-surface px-3.5 py-1.5 font-medium hover:bg-cream-warm"
        >
          {t("location.setManually")}
        </button>
      </div>
    </div>
  );
}
