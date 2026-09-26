export const BIO_MAX = 160;
export const PASSWORD_MIN = 8;
export const MAX_PARTICIPANTS_LIMIT = 1000;
export const FEE_MAX = 100_000_000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function isStrongPassword(pw: string): boolean {
  return pw.length >= PASSWORD_MIN && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

/**
 * Indonesian mobile numbers: 08xx / 628xx / +628xx.
 * Returns the normalized "+62..." form, or null when invalid.
 */
export function normalizeWhatsapp(raw: string): string | null {
  const compact = raw.replace(/[\s\-().]/g, "");
  const m = compact.match(/^(?:\+?62|0)(8\d{7,12})$/);
  return m ? `+62${m[1]}` : null;
}

/** For wa.me links: digits only, country code included. */
export function whatsappDigits(normalized: string): string {
  return normalized.replace(/\D/g, "");
}
