import type { Profile } from "@/types";

export type OnboardingStep = "profile" | "interests" | "done";

/** Personal-information step (Sign Up session 2) is complete. */
export function personalInfoComplete(p: Partial<Profile> | null | undefined): boolean {
  return Boolean(
    p?.full_name?.trim() &&
      p.nickname?.trim() &&
      p.whatsapp_number?.trim() &&
      p.gender &&
      p.city_id &&
      p.kecamatan_id &&
      p.kelurahan_id &&
      p.bio?.trim()
  );
}

/** Where a signed-in user should resume registration. */
export function onboardingStep(p: Partial<Profile> | null | undefined): OnboardingStep {
  if (p?.onboarding_completed_at || p?.role === "admin") return "done";
  return personalInfoComplete(p) ? "interests" : "profile";
}

/** Only allow same-origin relative redirects (avoid open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
