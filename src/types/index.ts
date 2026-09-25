export type UserRole = "admin" | "participant";
export type EventPrivacy = "public" | "private";
export type JoinPermission = "open" | "approval_required";
export type EventStatus =
  | "open"
  | "almost_full"
  | "full"
  | "ongoing"
  | "completed"
  | "cancelled";
export type ParticipationStatus = "pending" | "approved" | "rejected" | "cancelled";

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
  gender: string | null;
  whatsapp_number: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  city: string | null;
  bio: string | null;
  avatar_url: string | null;
  primary_interest_id: string | null;
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
  event_date: string;
  start_time: string;
  end_time: string;
  max_participants: number;
  fee: number;
  location_name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  pic_name: string;
  pic_whatsapp: string;
  pic_contact_instructions: string | null;
  whatsapp_public: boolean;
  privacy: EventPrivacy;
  join_permission: JoinPermission;
  status: EventStatus;
  created_at: string;
  // joined fields (populated by queries, not raw columns)
  category?: Category;
  participant_count?: number;
  distance_km?: number;
  organizer?: Profile;
}

export interface EventParticipant {
  id: string;
  event_id: string;
  user_id: string;
  status: ParticipationStatus;
  joined_at: string;
}

export const STATUS_LABEL: Record<EventStatus, { label: string; dot: string }> = {
  open: { label: "Open", dot: "🟢" },
  almost_full: { label: "Almost Full", dot: "🟡" },
  full: { label: "Full", dot: "🔴" },
  ongoing: { label: "Ongoing", dot: "🔵" },
  completed: { label: "Completed", dot: "⚪" },
  cancelled: { label: "Cancelled", dot: "⚫" },
};
