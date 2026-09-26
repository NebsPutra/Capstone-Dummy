import type { TranslationKey } from "@/lib/i18n/translations";

// Exceptions raised by our SQL functions (join_event, set_user_interests, ...)
const DOMAIN_CODES = [
  "NOT_AUTHENTICATED",
  "PROFILE_INCOMPLETE",
  "PROFILE_NOT_FOUND",
  "EVENT_NOT_FOUND",
  "EVENT_CANCELLED",
  "EVENT_STARTED",
  "EVENT_FULL",
  "REQUEST_REJECTED",
  "OWNER_CANNOT_JOIN",
  "INVITE_REQUIRED",
  "NOT_ALLOWED",
  "INTERESTS_REQUIRED",
  "PRIMARY_NOT_SELECTED",
  "PARTICIPANT_NOT_FOUND",
  "RATE_LIMITED",
  "COMPLAINT_CLOSED",
  "COMPLAINT_NOT_FOUND",
  "INVALID_FILE",
  "ACCOUNT_SUSPENDED",
  "LAST_SUPER_ADMIN",
  "CANNOT_CHANGE_SELF",
  "INVALID_ASSIGNEE",
  "USER_NOT_FOUND",
  "EVENT_NOT_CANCELLED",
  "UNKNOWN_SETTING",
] as const;

type ErrorLike = { message?: string; code?: string; status?: number; name?: string } | null | undefined;

/**
 * Map a Supabase / Postgres / auth error to a translation key a normal
 * user can understand. The raw error is logged for developers but never
 * shown in the UI.
 */
export function friendlyErrorKey(err: ErrorLike, context?: string): TranslationKey {
  if (err) console.error(`[komunitas]${context ? ` ${context}:` : ""}`, err);
  const message = err?.message ?? "";

  const domain = DOMAIN_CODES.find((c) => message.includes(c));
  if (domain) return `err.${domain}` as TranslationKey;

  if (/failed to fetch|network|load failed/i.test(message) || err?.name === "AuthRetryableFetchError") {
    return "err.network";
  }
  if (err?.status === 429 || /rate limit|too many/i.test(message) || err?.code === "over_email_send_rate_limit") {
    return "auth.tooManyRequests";
  }
  return "err.generic";
}

/** Auth-specific mapping for the verification-code steps. */
export function otpErrorKey(err: ErrorLike): TranslationKey {
  if (err) console.error("[komunitas] verifyOtp:", err);
  const message = err?.message ?? "";
  if (err?.status === 429 || /rate limit|too many/i.test(message)) return "auth.tooManyRequests";
  if (/failed to fetch|network/i.test(message)) return "err.network";
  // Supabase reports wrong and expired codes with the same "Token has
  // expired or is invalid" message; only a dedicated otp_expired code is
  // treated as expiry, everything else as an incorrect code.
  if (err?.code === "otp_expired" && !/invalid/i.test(message)) return "auth.codeExpired";
  return "auth.codeIncorrect";
}
