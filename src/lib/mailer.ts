import "server-only";
import nodemailer from "nodemailer";

export const escapeHtml = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Sends one email over the configured SMTP account. Returns false (and logs) on failure. */
export async function sendMail(msg: { to: string; subject: string; text: string; html: string }): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error("[komunitas] sendMail: SMTP is not configured");
    return false;
  }
  const port = Number(SMTP_PORT || 465);
  try {
    await nodemailer
      .createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } })
      .sendMail({ from: SMTP_FROM || `Komunitas <${SMTP_USER}>`, ...msg });
    return true;
  } catch (e) {
    console.error("[komunitas] sendMail:", e);
    return false;
  }
}

/**
 * Simple branded email body: a heading, paragraphs, an optional button and an
 * optional footer (why the email was sent). Colors meet WCAG AA contrast.
 */
export function simpleEmailHtml(
  heading: string,
  paragraphs: string[],
  action?: { label: string; href: string },
  footer?: string
) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2b2118">
  <h2 style="color:#c2410c">${escapeHtml(heading)}</h2>
  ${paragraphs.map((p) => `<p style="line-height:1.5">${escapeHtml(p)}</p>`).join("\n  ")}
  ${action ? `<p><a href="${escapeHtml(action.href)}" style="display:inline-block;background:#c2410c;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">${escapeHtml(action.label)}</a></p>` : ""}
  <p style="color:#6b625b;font-size:12px;line-height:1.5">${footer ? `${escapeHtml(footer)}<br>` : ""}Komunitas</p>
</div>`;
}
