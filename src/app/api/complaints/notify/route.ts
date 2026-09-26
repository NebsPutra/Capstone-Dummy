import { NextResponse, type NextRequest } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";

// Emails a new complaint to the admin inbox. Runs on the server only: the
// SMTP credentials and the admin address never reach the browser.
//
// Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (optional),
//      ADMIN_NOTIFY_EMAIL (defaults to the project owner's inbox).
export const runtime = "nodejs";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface Payload {
  id: string;
  ref: string;
  created_at: string;
  category: string;
  severity: string;
  status: string;
  subject: string;
  description: string;
  contact: string | null;
  is_anonymous: boolean;
  email_enabled: boolean;
  reporter: { name: string; username: string; email: string } | null;
  event: { id: string; ref: string; title: string } | null;
  related_user: { username: string; name: string | null } | null;
  attachments: { name: string; path: string }[];
}

export async function POST(req: NextRequest) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  // The caller's own session: only the reporter (once) or staff may trigger this.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complaint_email_payload", { p_complaint: id });
  if (error || !data) return NextResponse.json({ error: "not allowed" }, { status: 403 });
  const c = data as Payload;

  if (!c.email_enabled) {
    await supabase.rpc("set_complaint_email_status", { p_complaint: id, p_status: "skipped", p_error: null });
    return NextResponse.json({ status: "skipped" });
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    await supabase.rpc("set_complaint_email_status", { p_complaint: id, p_status: "failed", p_error: "SMTP is not configured" });
    return NextResponse.json({ error: "email not configured" }, { status: 503 });
  }

  const to = process.env.ADMIN_NOTIFY_EMAIL || "bennedictusputra@gmail.com";
  const link = `${req.nextUrl.origin}/admin/complaints/${c.id}`;
  const when = new Date(c.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const reporter = c.is_anonymous || !c.reporter ? "Anonymous" : `${c.reporter.name} (@${c.reporter.username}, ${c.reporter.email})`;
  const rows: [string, string][] = [
    ["Complaint ID", c.ref],
    ["Date/time", `${when} WIB`],
    ["User", reporter],
    ["Category", c.category],
    ["Severity", c.severity],
    ["Subject", c.subject],
    ["Related event", c.event ? `${c.event.ref}: ${c.event.title}` : "—"],
    ["Related user", c.related_user ? `@${c.related_user.username}` : "—"],
    ["Contact", c.contact ?? "—"],
    ["Attachments", c.attachments.length ? c.attachments.map((a) => a.name).join(", ") : "—"],
  ];

  const html = `<div style="font-family:system-ui,sans-serif;max-width:640px">
<h2 style="color:#C2410C">${c.severity === "CRITICAL" ? "[CRITICAL] " : ""}New complaint ${esc(c.ref)}</h2>
<table style="border-collapse:collapse;width:100%">${rows
    .map(([k, v]) => `<tr><td style="padding:6px 10px;border:1px solid #eee;font-weight:600;width:160px">${esc(k)}</td><td style="padding:6px 10px;border:1px solid #eee">${esc(v)}</td></tr>`)
    .join("")}</table>
<h3>Description</h3><p style="white-space:pre-line">${esc(c.description)}</p>
<p><a href="${esc(link)}" style="background:#F97316;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open in Admin</a></p>
<p style="color:#888;font-size:12px">Attachments are stored privately and can be opened from the admin complaint page.</p></div>`;
  const text = `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${c.description}\n\n${link}`;

  try {
    const port = Number(SMTP_PORT || 465);
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transport.sendMail({
      from: SMTP_FROM || `Komunitas <${SMTP_USER}>`,
      to,
      subject: `${c.severity === "CRITICAL" ? "[CRITICAL] " : ""}[Komunitas] ${c.ref}: ${c.subject}`,
      html,
      text,
    });
    await supabase.rpc("set_complaint_email_status", { p_complaint: id, p_status: "sent", p_error: null });
    return NextResponse.json({ status: "sent" });
  } catch (err) {
    console.error("[komunitas] complaint email failed:", err);
    await supabase.rpc("set_complaint_email_status", {
      p_complaint: id,
      p_status: "failed",
      p_error: err instanceof Error ? err.message : "send failed",
    });
    return NextResponse.json({ error: "send failed" }, { status: 502 });
  }
}
