"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { ROLES, ROLE_RANK } from "@/lib/admin";
import { GENDERS, type Interest, type Profile } from "@/types";
import { useToast } from "@/components/Toast";
import { FieldShell, PrimaryButton, inputClass } from "@/components/ui";
import { Badge, PageHeader, fmtDateTime, useRpc } from "@/components/admin/ui";
import { InterestPicker, PrimaryInterestSelect } from "@/components/InterestPicker";
import { LocationSelect, type LocationValue } from "@/components/LocationSelect";

interface Detail {
  profile: Profile & { account_status: string; status_reason: string | null; province_id: string | null; province: string | null };
  email: string | null; last_sign_in_at: string | null; email_confirmed_at: string | null; interests: string[];
  created_events: { id: string; ref: string; title: string; event_date: string; status: string }[];
  joined_events: { id: string; ref: string; title: string; event_date: string; participation: string }[];
  complaints: { id: string; ref: string; subject: string; status: string; created_at: string }[];
  history: { action: string; created_at: string; actor: string | null; new_value: Record<string, unknown> | null }[];
}

export default function AdminUserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, td, lang } = useLanguage();
  const toast = useToast();
  const { data: d, reload } = useRpc<Detail>("admin_user_detail", { p_user: id }, [id]);
  const [myRank, setMyRank] = useState(0);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loc, setLoc] = useState<LocationValue | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [primary, setPrimary] = useState("");

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(async ({ data: { user } }) => {
      const { data } = await sb.from("profiles").select("role").eq("id", user!.id).single();
      setMyRank(ROLE_RANK[data?.role ?? ""] ?? 0);
    });
    sb.from("interests").select("*").order("sort_order").then(({ data }) => setInterests(data ?? []));
  }, []);

  useEffect(() => {
    if (!d) return;
    const p = d.profile;
    setForm({ full_name: p.full_name ?? "", nickname: p.nickname ?? "", gender: p.gender ?? "", whatsapp_number: p.whatsapp_number ?? "", bio: p.bio ?? "" });
    setLoc({
      provinceId: p.province_id ?? "", province: p.province ?? "", cityId: p.city_id ?? "", city: p.city ?? "",
      kecamatanId: p.kecamatan_id ?? "", kecamatan: p.kecamatan ?? "", kelurahanId: p.kelurahan_id ?? "", kelurahan: p.kelurahan ?? "",
    });
    setSel(d.interests);
    setPrimary(p.primary_interest_id ?? "");
  }, [d]);

  async function run(fn: () => PromiseLike<{ error: unknown }>, ok: TranslationKey) {
    if (busy) return;
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return toast(t(friendlyErrorKey(error as { message?: string }, ok)), "error");
    toast(t(ok));
    reload();
  }

  if (!d) return <div className="skeleton h-96" />;
  const p = d.profile;
  const sb = createClient();
  const canEdit = myRank >= 2;

  function saveProfile() {
    const patch: Record<string, unknown> = { ...form, gender: form.gender || null };
    if (loc?.cityId) {
      Object.assign(patch, {
        province_id: loc.provinceId || loc.cityId.slice(0, 2), province: loc.province || null, city_id: loc.cityId, city: loc.city,
        kecamatan_id: loc.kecamatanId || null, kecamatan: loc.kecamatan || null, kelurahan_id: loc.kelurahanId || null, kelurahan: loc.kelurahan || null,
      });
    }
    run(() => sb.rpc("admin_update_user", { p_user: id, p_patch: patch }), "ausers.saved");
  }

  function setStatus(status: "active" | "suspended" | "deactivated") {
    const key: TranslationKey = status === "active" ? "ausers.restoreConfirm" : status === "suspended" ? "ausers.suspendConfirm" : "ausers.deactivateConfirm";
    if (!window.confirm(t(key, { username: p.username }))) return;
    const reason = status === "active" ? null : window.prompt(t("ausers.reason")) ?? null;
    run(() => sb.rpc("admin_set_account_status", { p_user: id, p_status: status, p_reason: reason }), "ausers.statusChanged");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.full_name || p.nickname || p.username}
        subtitle={`@${p.username} · ${d.email ?? ""}`}
        actions={<Badge value={p.account_status} label={t(`account.status.${p.account_status}` as "account.status.active")} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card space-y-2 p-5 text-sm">
          <h2 className="font-semibold">{t("ausers.account")}</h2>
          <p>{t("col.role")}: <b>{t(`role.${p.role}` as TranslationKey)}</b></p>
          <p>{t("col.registered")}: {fmtDateTime(p.created_at, lang)}</p>
          <p>{t("col.lastActive")}: {d.last_sign_in_at ? fmtDateTime(d.last_sign_in_at, lang) : t("ausers.never")}</p>
          <p>{t("ausers.emailVerified")}: {d.email_confirmed_at ? "✓" : "—"}</p>
          {p.status_reason && <p className="text-ink/60">{t("suspended.reason", { reason: p.status_reason })}</p>}
          {canEdit && (
            <div className="flex flex-wrap gap-2 pt-2">
              {p.account_status !== "active" ? (
                <button disabled={busy} onClick={() => setStatus("active")} className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">{t("ausers.restore")}</button>
              ) : (
                <>
                  <button disabled={busy} onClick={() => setStatus("suspended")} className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white">{t("ausers.suspend")}</button>
                  <button disabled={busy} onClick={() => setStatus("deactivated")} className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold">{t("ausers.deactivate")}</button>
                </>
              )}
            </div>
          )}
          {myRank >= 3 && (
            <div className="space-y-2 border-t border-ink/5 pt-3">
              <label className="flex items-center gap-2">
                {t("col.role")}
                <select
                  value={p.role}
                  disabled={busy}
                  onChange={(e) => {
                    const r = e.target.value;
                    if (window.confirm(t("ausers.roleConfirm", { username: p.username, role: t(`role.${r}` as TranslationKey) })))
                      run(() => sb.rpc("admin_set_role", { p_user: id, p_role: r }), "ausers.roleChanged");
                  }}
                  className="rounded-lg border border-ink/10 bg-surface px-2 py-1"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{t(`role.${r}` as TranslationKey)}</option>
                  ))}
                </select>
              </label>
              <p className="pt-2 text-xs font-semibold uppercase text-red-600">{t("ausers.dangerZone")}</p>
              <button
                disabled={busy}
                onClick={() => {
                  if (window.prompt(t("ausers.anonymizeConfirm")) === "ANONYMIZE")
                    run(() => sb.rpc("admin_anonymize_user", { p_user: id }), "ausers.anonymized");
                }}
                className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600"
              >
                {t("ausers.anonymize")}
              </button>
            </div>
          )}
        </section>

        <section className="card space-y-3 p-5 lg:col-span-2">
          <h2 className="font-semibold">{t("ausers.edit")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["full_name", "nickname", "whatsapp_number"] as const).map((k) => (
              <FieldShell key={k} id={k} label={t(k === "full_name" ? "register.fullName" : k === "nickname" ? "register.nickname" : "register.whatsapp")}>
                <input id={k} disabled={!canEdit} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={inputClass()} />
              </FieldShell>
            ))}
            <FieldShell id="gender" label={t("register.gender")}>
              <select id="gender" disabled={!canEdit} value={form.gender ?? ""} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={inputClass()}>
                <option value="">—</option>
                {GENDERS.map((g) => <option key={g} value={g}>{t(`gender.${g}`)}</option>)}
              </select>
            </FieldShell>
          </div>
          <FieldShell id="bio" label={t("register.bio")}>
            <textarea id="bio" rows={2} disabled={!canEdit} value={form.bio ?? ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} className={inputClass()} />
          </FieldShell>
          {loc && <LocationSelect value={loc} onChange={setLoc} idPrefix="admin-" />}
          {canEdit && <PrimaryButton onClick={saveProfile} loading={busy}>{t("common.save")}</PrimaryButton>}

          <h3 className="pt-3 text-sm font-semibold">{t("ausers.interests")}</h3>
          <InterestPicker interests={interests} selected={sel} onToggle={(i) => setSel(sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i])} />
          <PrimaryInterestSelect interests={interests} selected={sel} value={primary} onChange={setPrimary} />
          {canEdit && (
            <PrimaryButton onClick={() => run(() => sb.rpc("admin_set_user_interests", { p_user: id, p_interest_ids: sel, p_primary: primary }), "ausers.saved")} loading={busy}>
              {t("common.save")}
            </PrimaryButton>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { title: t("ausers.createdEvents"), rows: d.created_events.map((e) => ({ href: `/admin/events/${e.id}`, a: `${e.ref} · ${e.title}`, b: td(`status.${e.status}`, e.status) })) },
          { title: t("ausers.joinedEvents"), rows: d.joined_events.map((e) => ({ href: `/admin/events/${e.id}`, a: `${e.ref} · ${e.title}`, b: td(`participation.${e.participation}`, e.participation) })) },
          { title: t("ausers.complaints"), rows: d.complaints.map((c) => ({ href: `/admin/complaints/${c.id}`, a: `${c.ref} · ${c.subject}`, b: td(`complaint.status.${c.status}`, c.status) })) },
        ].map((s) => (
          <section key={s.title} className="card space-y-2 p-5">
            <h2 className="text-sm font-semibold">{s.title}</h2>
            {s.rows.length === 0 ? <p className="text-sm text-ink/50">—</p> : s.rows.map((r) => (
              <Link key={r.href + r.a} href={r.href} className="flex justify-between gap-2 text-sm hover:text-orange-dark">
                <span className="truncate">{r.a}</span><span className="shrink-0 text-xs text-ink/50">{r.b}</span>
              </Link>
            ))}
          </section>
        ))}
      </div>

      <section className="card space-y-2 p-5">
        <h2 className="text-sm font-semibold">{t("ausers.history")}</h2>
        {d.history.length === 0 ? <p className="text-sm text-ink/50">—</p> : (
          <ul className="space-y-1 text-sm">
            {d.history.map((h, i) => (
              <li key={i} className="flex flex-wrap gap-2">
                <time className="text-xs text-ink/40">{fmtDateTime(h.created_at, lang)}</time>
                <span className="font-medium">{h.action}</span>
                <span className="text-ink/50">@{h.actor ?? "system"}</span>
                {h.new_value && <code className="truncate text-xs text-ink/50">{JSON.stringify(h.new_value)}</code>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
