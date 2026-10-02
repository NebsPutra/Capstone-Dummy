// Mirrors supabase/schema.sql + supabase/migrations/*. Keep these in sync
// when the schema changes (the project doesn't use generated types).

export type UserRole = "admin" | "participant";
export type Gender = "male" | "female";
export type EventPrivacy = "public" | "private";
export type JoinPermission = "open" | "approval_required";
export type SkillLevel = "beginner" | "all" | "experienced";
/** Stored `events.status` (Postgres enum `event_status`). */
export type EventStatus =
  | "open"
  | "almost_full"
  | "full"
  | "ongoing"
  | "completed"
  | "cancelled";
export type ParticipationStatus = "pending" | "approved" | "rejected" | "cancelled";

export const GENDERS: Gender[] = ["male", "female"];

export interface Interest {
  id: string;
  key: string;
  label: string;
  emoji: string;
}

export interface Category {
  id: string;
  key: string;
  label: string;
  emoji: string;
}

export interface Profile {
  id: string;
  username: string;
  role: UserRole;
  full_name: string | null;
  nickname: string | null;
  age: number | null;
  gender: Gender | null;
  whatsapp_number: string | null;
  province: string | null;
  province_id: string | null;
  city: string | null;
  city_id: string | null;
  kecamatan: string | null;
  kecamatan_id: string | null;
  kelurahan: string | null;
  kelurahan_id: string | null;
  area_lat: number | null;
  area_lng: number | null;
  bio: string | null;
  avatar_url: string | null;
  primary_interest_id: string | null;
  onboarding_completed_at: string | null;
  /** When the sign-in PIN was last set (migration 005); null = no PIN. */
  pin_set_at?: string | null;
  created_at: string;
}

export interface EventRecord {
  id: string;
  event_code: string;
  share_token: string;
  creator_id: string;
  category_id: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  /** Local (Asia/Jakarta) calendar date, YYYY-MM-DD */
  event_date: string;
  /** Local (Asia/Jakarta) wall-clock time, HH:MM[:SS] */
  start_time: string;
  end_time: string;
  max_participants: number;
  /** Whole Rupiah. Postgres numeric — may arrive as a string; use toFee(). */
  fee: number | string;
  location_name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  pic_name: string;
  pic_contact_instructions: string | null;
  whatsapp_public: boolean;
  privacy: EventPrivacy;
  join_permission: JoinPermission;
  skill_level: SkillLevel;
  /** Weekly series this date belongs to (migration 017), else null. */
  series_id: string | null;
  /** Group the activity belongs to (migration 019), else null. Members only: not readable by guests. */
  group_id?: string | null;
  status: EventStatus;
  /** Approved participants, maintained by a DB trigger. */
  participant_count: number;
  created_at: string;
  // joined / computed fields (populated by queries, not raw columns)
  category?: Category | null;
  distance_km?: number;
  organizer?: Pick<Profile, "id" | "nickname" | "username"> | null;
}

export interface EventParticipant {
  id: string;
  event_id: string;
  user_id: string;
  status: ParticipationStatus;
  joined_at: string;
}

/** Columns selected for event lists (cards, dashboard, explore). */
export const EVENT_LIST_SELECT = "*, category:categories(*)";

/**
 * The columns logged-out visitors may read (column grants in migration 015).
 * No organizer contact, share token or creator: rows selected with this are
 * EventRecords without those fields, so never render them for guests.
 */
export const PUBLIC_EVENT_SELECT: string =
  "id, event_code, category_id, title, description, banner_url, event_date, start_time, end_time, max_participants, fee, location_name, address, latitude, longitude, privacy, join_permission, status, participant_count, skill_level, series_id, created_at, category:categories(*)";
