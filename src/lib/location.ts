"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Where "near me" is, per device:
 *   - live GPS (browser geolocation, never persisted server-side), or
 *   - a manually selected area (approximate centroid of a kelurahan).
 * The choice and whether GPS permission was denied are remembered in
 * localStorage so the browser permission prompt isn't triggered repeatedly.
 */

export interface ManualArea {
  lat: number;
  lng: number;
  label: string;
}

interface StoredPref {
  mode: "gps" | "manual";
  manual?: ManualArea;
  gpsDenied?: boolean;
}

export type UserLocation =
  | { status: "checking" }
  | { status: "locating" }
  | { status: "ready"; source: "gps" | "manual"; lat: number; lng: number; label?: string }
  | { status: "unavailable"; reason: "denied" | "unsupported" | "error" | "not-asked" };

const PREF_KEY = "komunitas-location";

function readPref(): StoredPref {
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (raw) return JSON.parse(raw) as StoredPref;
  } catch {
    // ignore — treat as no preference
  }
  return { mode: "gps" };
}

function writePref(pref: StoredPref) {
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(pref));
  } catch {
    // storage unavailable — preference lasts for this page only
  }
}

async function permissionState(): Promise<PermissionState | "unsupported"> {
  try {
    if (!navigator.permissions?.query) return "unsupported";
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unsupported";
  }
}

/**
 * GPS is used automatically only when permission was already granted; the
 * browser prompt only ever appears after a tap on "Use GPS" (switchToGps), so a
 * first visit isn't greeted by a permission pop-up.
 * @param fallback Area to use when there's no GPS and no saved choice, e.g. the
 *   kelurahan from registration (dashboard). Not saved as the user's choice.
 */
export function useUserLocation({ fallback = null }: { fallback?: ManualArea | null } = {}) {
  const [location, setLocation] = useState<UserLocation>({ status: "checking" });
  const inFlight = useRef(false);

  const locateWithGps = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocation({ status: "unavailable", reason: "unsupported" });
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setLocation({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        inFlight.current = false;
        writePref({ ...readPref(), mode: "gps", gpsDenied: false });
        setLocation({
          status: "ready",
          source: "gps",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        inFlight.current = false;
        const denied = err.code === err.PERMISSION_DENIED;
        if (denied) writePref({ ...readPref(), gpsDenied: true });
        // Fall back to a previously chosen manual area, or the given fallback.
        const manual = readPref().manual ?? fallback;
        if (manual) {
          setLocation({ status: "ready", source: "manual", ...manual });
        } else {
          setLocation({ status: "unavailable", reason: denied ? "denied" : "error" });
        }
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000 }
    );
  }, [fallback]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = readPref();
      // The fallback area stands in for a manual choice, without being saved.
      const pref = { ...saved, manual: saved.manual ?? fallback ?? undefined };
      if (pref.mode === "manual" && pref.manual) {
        setLocation({ status: "ready", source: "manual", ...pref.manual });
        return;
      }
      if (!("geolocation" in navigator)) {
        setLocation(
          pref.manual
            ? { status: "ready", source: "manual", ...pref.manual }
            : { status: "unavailable", reason: "unsupported" }
        );
        return;
      }
      const state = await permissionState();
      if (cancelled) return;

      if (state === "granted") {
        locateWithGps();
      } else if (state === "denied" || pref.gpsDenied) {
        if (state === "denied") writePref({ ...saved, gpsDenied: true });
        setLocation(
          pref.manual
            ? { status: "ready", source: "manual", ...pref.manual }
            : { status: "unavailable", reason: "denied" }
        );
      } else {
        setLocation(
          pref.manual
            ? { status: "ready", source: "manual", ...pref.manual }
            : { status: "unavailable", reason: "not-asked" }
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fallback, locateWithGps]);

  const setManual = useCallback((area: ManualArea) => {
    writePref({ ...readPref(), mode: "manual", manual: area });
    setLocation({ status: "ready", source: "manual", ...area });
  }, []);

  /** User-initiated: switch back to GPS / refresh the GPS fix. */
  const switchToGps = useCallback(() => {
    writePref({ ...readPref(), mode: "gps" });
    locateWithGps();
  }, [locateWithGps]);

  return { location, setManual, switchToGps };
}
