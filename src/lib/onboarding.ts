import type { Profile } from "@/types";

export type OnboardingStep = "pin" | "profile" | "interests" | "done";

/** Personal-information step (Sign Up session 2) is complete. */
export function personalInfoComplete(p: Partial<Profile> | null | undefined): boolean {
  return Boolean(
    // WhatsApp, gender and bio are optional (migration 011).
    p?.full_name?.trim() && p.nickname?.trim() && p.city_id && p.kecamatan_id && p.kelurahan_id
  );
}

/** Where a signed-in user should resume registration. */
export function onboardingStep(p: Partial<Profile> | null | undefined): OnboardingStep {
  if (p?.onboarding_completed_at || p?.role === "admin") return "done";
  // New accounts create their sign-in PIN right after verifying their email.
  // (Accounts that finished onboarding before PINs existed set one later.)
  if (p && "pin_set_at" in p && !p.pin_set_at) return "pin";
  return personalInfoComplete(p) ? "interests" : "profile";
}

/** Where to send a user right after signing in. */
export function postLoginPath(p: Partial<Profile> | null | undefined, next: string | null | undefined): string {
  if (onboardingStep(p) !== "done") return "/register?resume=1";
  return p?.role === "admin" ? "/admin" : safeNext(next);
}

/** Only allow same-origin relative redirects (avoid open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
