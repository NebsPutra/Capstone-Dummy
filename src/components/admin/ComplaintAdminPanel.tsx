"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { COMPLAINT_SEVERITIES, COMPLAINT_STATUSES, type Complaint } from "@/lib/admin";
import { useToast } from "../Toast";
import { Badge } from "./ui";

/** Assign, change status/severity, resolve/reopen, resend the admin email. */
export function ComplaintAdminPanel({ complaint: c, staff }: { complaint: Complaint; staff: { id: string; username: string; full_name: string | null }[] }) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const sb = createClient();

  async function update(args: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    const { error } = await sb.rpc("admin_update_complaint", { p_complaint: c.id, ...args });
    setBusy(false);
    if (error) return toast(t(friendlyErrorKey(error, "admin_update_complaint")), "error");
    toast(t("acomp.updated"));
    router.refresh();
  }

  async function assignMe() {
    const { data: { user } } = await sb.auth.getUser();
    if (user) update({ p_assigned_to: user.id });
  }

  async function resend() {
    setBusy(true);
    const res = await fetch("/api/complaints/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) });
    setBusy(false);
    toast(res.ok ? t("acomp.emailSent") : t("err.generic"), res.ok ? "success" : "error");
    router.refresh();
  }

  const sel = "rounded-lg border border-ink/10 bg-surface px-2 py-1.5 text-sm";
  const open = ["OPEN", "IN_REVIEW", "WAITING_FOR_USER"].includes(c.status);
  return (
    <section className="card flex flex-wrap items-end gap-4 p-5 text-sm">
      <label className="space-y-1">
        <span className="block text-xs text-ink/50">{t("col.status")}</span>
        <select className={sel} value={c.status} disabled={busy} onChange={(e) => update({ p_status: e.target.value })}>
          {COMPLAINT_STATUSES.map((s) => <option key={s} value={s}>{t(`complaint.status.${s}`)}</option>)}
        </select>
      </label>
      <label className="space-y-1">
        <span className="block text-xs text-ink/50">{t("col.severity")}</span>
        <select className={sel} value={c.severity} disabled={busy} onChange={(e) => update({ p_severity: e.target.value })}>
          {COMPLAINT_SEVERITIES.map((s) => <option key={s} value={s}>{t(`complaint.severity.${s}`)}</option>)}
        </select>
      </label>
      <label className="space-y-1">
        <span className="block text-xs text-ink/50">{t("acomp.assign")}</span>
        <select className={sel} value={c.assigned_to ?? ""} disabled={busy}
          onChange={(e) => update(e.target.value ? { p_assigned_to: e.target.value } : { p_unassign: true })}>
          <option value="">{t("acomp.unassigned")}</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name ?? `@${s.username}`}</option>)}
        </select>
      </label>
      <button disabled={busy} onClick={assignMe} className="rounded-full border border-ink/10 px-3 py-1.5 font-medium">{t("acomp.assignMe")}</button>
      {open ? (
        <button disabled={busy} onClick={() => update({ p_status: "RESOLVED" })} className="rounded-full bg-green-600 px-3 py-1.5 font-semibold text-white">{t("complaint.status.RESOLVED")}</button>
      ) : (
        <button disabled={busy} onClick={() => update({ p_status: "IN_REVIEW" })} className="rounded-full border border-ink/10 px-3 py-1.5 font-medium">{t("acomp.reopen")}</button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-ink/50">{t("acomp.email")}</span>
        <Badge value={c.email_status === "sent" ? "RESOLVED" : c.email_status === "failed" ? "CRITICAL" : "CLOSED"} kind={c.email_status === "failed" ? "severity" : "status"}
          label={t(`acomp.emailStatus.${c.email_status}`)} />
        <button disabled={busy} onClick={resend} className="text-xs font-semibold text-orange-dark">{t("acomp.resendEmail")}</button>
      </div>
    </section>
  );
}
