// Shared vocabulary for complaints and the admin area. These are the stable
// values stored in the database; the UI translates them.

export const COMPLAINT_CATEGORIES = [
  "account",
  "login_registration",
  "event",
  "event_organizer",
  "participant",
  "payment_fee",
  "location_gps",
  "app_bug",
  "content",
  "harassment_abuse",
  "technical",
  "other",
] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export const COMPLAINT_STATUSES = ["OPEN", "IN_REVIEW", "WAITING_FOR_USER", "RESOLVED", "CLOSED", "REJECTED"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];
export const OPEN_COMPLAINT_STATUSES: ComplaintStatus[] = ["OPEN", "IN_REVIEW", "WAITING_FOR_USER"];

export const COMPLAINT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type ComplaintSeverity = (typeof COMPLAINT_SEVERITIES)[number];

export const ROLES = ["participant", "moderator", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_RANK: Record<string, number> = { participant: 0, moderator: 1, admin: 2, super_admin: 3 };

export const ACCOUNT_STATUSES = ["active", "suspended", "deactivated"] as const;

export interface Complaint {
  id: string;
  ref: string;
  reporter_id: string | null;
  is_anonymous: boolean;
  category: ComplaintCategory;
  severity: ComplaintSeverity;
  status: ComplaintStatus;
  subject: string;
  description: string;
  contact: string | null;
  related_event_id: string | null;
  related_user_id: string | null;
  assigned_to: string | null;
  email_status: "pending" | "sent" | "failed" | "skipped";
  created_at: string;
  updated_at: string;
  last_activity_at: string;
}

export interface ComplaintMessage {
  id: string;
  complaint_id: string;
  author_id: string | null;
  from_staff: boolean;
  is_internal: boolean;
  body: string;
  created_at: string;
}

export interface ComplaintHistory {
  id: number;
  kind: "submitted" | "status" | "assigned" | "severity";
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export const SEVERITY_TONE: Record<string, string> = {
  LOW: "bg-stone-100 text-stone-500",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-amber-50 text-amber-700",
  CRITICAL: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-700",
  critical: "bg-red-50 text-red-700",
};

export const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700",
  IN_REVIEW: "bg-blue-50 text-blue-700",
  WAITING_FOR_USER: "bg-orange/10 text-orange-dark",
  RESOLVED: "bg-green-50 text-green-700",
  CLOSED: "bg-stone-100 text-stone-500",
  REJECTED: "bg-stone-100 text-stone-500",
  active: "bg-green-50 text-green-700",
  suspended: "bg-red-50 text-red-700",
  deactivated: "bg-stone-100 text-stone-500",
};

// ---------------------------------------------------------------------------
// Date ranges for dashboards/exports (computed in the browser, sent as ISO).
// ---------------------------------------------------------------------------

export type RangeKey = "today" | "7d" | "30d" | "90d" | "year" | "custom";
export const RANGE_KEYS: RangeKey[] = ["today", "7d", "30d", "90d", "year", "custom"];

export interface DateRange {
  key: RangeKey;
  from: string; // ISO timestamp
  to: string;
}

export function rangeFor(key: RangeKey, custom?: { from: string; to: string }): DateRange {
  const now = new Date();
  const end = new Date(now.getTime() + 60_000);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const days = (n: number) => new Date(now.getTime() - n * 86_400_000);
  switch (key) {
    case "today":
      return { key, from: startOfDay.toISOString(), to: end.toISOString() };
    case "7d":
      return { key, from: days(7).toISOString(), to: end.toISOString() };
    case "90d":
      return { key, from: days(90).toISOString(), to: end.toISOString() };
    case "year":
      return { key, from: new Date(now.getFullYear(), 0, 1).toISOString(), to: end.toISOString() };
    case "custom":
      if (custom?.from && custom?.to) {
        return {
          key,
          from: new Date(`${custom.from}T00:00:00`).toISOString(),
          to: new Date(`${custom.to}T23:59:59`).toISOString(),
        };
      }
      return { key: "30d", from: days(30).toISOString(), to: end.toISOString() };
    default:
      return { key: "30d", from: days(30).toISOString(), to: end.toISOString() };
  }
}

export function pctChange(now: number, prev: number): number | null {
  if (!prev) return now ? null : 0;
  return Math.round(((now - prev) / prev) * 100);
}

/** Mask personal data in exports: "budi@gmail.com" -> "b***@gmail.com". */
export function maskEmail(v: string | null | undefined): string {
  if (!v) return "";
  const [name, domain] = v.split("@");
  return domain ? `${name.slice(0, 1)}***@${domain}` : "***";
}
export function maskPhone(v: string | null | undefined): string {
  if (!v) return "";
  return v.length > 5 ? `${v.slice(0, 5)}****${v.slice(-2)}` : "***";
}
