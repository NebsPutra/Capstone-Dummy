// Shared vocabulary for usernames, privacy, friends and social links. The
// database is the authority (migration 006); these mirror its rules for
// instant feedback in the UI.

export const USERNAME_RE = /^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$/;

export type UsernameStatus = "invalid" | "reserved" | "taken" | "current" | "available";

export const VISIBILITIES = ["everyone", "friends", "only_me"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export type Relationship = "self" | "blocked" | "unavailable" | "friends" | "outgoing" | "incoming" | "none";

export interface PersonCard {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  primary_interest: { key: string; label: string; emoji: string | null } | null;
  mutual: number;
  relationship: Relationship;
  since?: string;
  sent_at?: string;
}

export interface PrivacySettings {
  profile_visibility: Visibility;
  show_full_name: boolean;
  show_gender: boolean;
  show_age: boolean;
  show_location: boolean;
  show_activities: boolean;
  show_friends: Visibility;
  friend_requests: "everyone" | "nobody";
  messages: "everyone" | "friends" | "nobody";
  searchable: boolean;
}

export const SOCIAL_PLATFORMS = ["instagram", "tiktok", "x", "facebook", "linkedin", "youtube", "strava", "website"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface SocialLink {
  platform: SocialPlatform;
  value: string;
  visibility: Visibility;
}

const HANDLE_RE = /^[A-Za-z0-9._-]{1,60}$/;
const WEBSITE_RE = /^https:\/\/[^\s<>"'`]{3,200}$/;

const PREFIX: Record<Exclude<SocialPlatform, "website">, string> = {
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/@",
  x: "https://x.com/",
  facebook: "https://www.facebook.com/",
  linkedin: "https://www.linkedin.com/in/",
  youtube: "https://www.youtube.com/@",
  strava: "https://www.strava.com/athletes/",
};

/**
 * Turn what the user typed ("@budi", "instagram.com/budi/", "budi") into the
 * stored value: a bare handle, or an https URL for websites. Null = invalid.
 */
export function normalizeSocial(platform: SocialPlatform, raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (platform === "website") {
    const url = /^https?:\/\//i.test(v) ? v.replace(/^http:\/\//i, "https://") : `https://${v}`;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || !parsed.hostname.includes(".")) return null;
    } catch {
      return null;
    }
    return WEBSITE_RE.test(url) ? url : null;
  }
  const handle = v
    .replace(/^https?:\/\/(www\.)?[^/]+\/(in\/|athletes\/)?/i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
  return HANDLE_RE.test(handle) ? handle : null;
}

/** Safe outbound URL for a stored link (never anything but https). */
export function socialUrl(link: Pick<SocialLink, "platform" | "value">): string | null {
  if (link.platform === "website") return WEBSITE_RE.test(link.value) ? link.value : null;
  return HANDLE_RE.test(link.value) ? PREFIX[link.platform] + encodeURIComponent(link.value) : null;
}

export function socialLabel(link: Pick<SocialLink, "platform" | "value">): string {
  if (link.platform === "website") return link.value.replace(/^https:\/\//, "").replace(/\/$/, "");
  return link.platform === "strava" ? link.value : `@${link.value}`;
}
