import type { TranslationKey } from "@/lib/i18n/translations";

export const PIN_LENGTH = 6;

// Mirrors public.pin_is_weak() in migration 005 (the database is the authority).
const COMMON = new Set(["121212", "112233", "123123", "696969", "131313", "101010", "147258", "159753", "111222", "000111"]);

export function pinIssue(pin: string): TranslationKey | null {
  if (!/^\d{6}$/.test(pin)) return "pin.errFormat";
  if (/^(\d)\1{5}$/.test(pin) || "0123456789012345".includes(pin) || "9876543210987654".includes(pin) || COMMON.has(pin)) {
    return "pin.errWeak";
  }
  return null;
}
