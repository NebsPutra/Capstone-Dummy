"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtSign, CheckCircle2, Globe, Link2, Loader2, Plus, Trash2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";
import {
  SOCIAL_PLATFORMS,
  USERNAME_RE,
  VISIBILITIES,
  normalizeSocial,
  type PrivacySettings,
  type SocialLink,
  type SocialPlatform,
  type UsernameStatus,
  type Visibility,
} from "@/lib/social";
import { useToast } from "../Toast";
import { Alert, PrimaryButton, inputClass } from "../ui";
import { Avatar } from "./People";
import { PushToggle } from "@/components/PushToggle";

// ---------------------------------------------------------------------------
// Username
// ---------------------------------------------------------------------------

export type UsernameCheck = UsernameStatus | "checking" | "empty";

/** Username input with a live, debounced availability check. */
export function UsernameField({
  id = "username",
  value,
  onChange,
  onStatus,
  hasError,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onStatus?: (s: UsernameCheck) => void;
  hasError?: boolean;
}) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<UsernameCheck>("empty");
  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  useEffect(() => {
    const v = value.trim().toLowerCase().replace(/^@/, "");
    const set = (s: UsernameCheck) => {
      setStatus(s);
      onStatusRef.current?.(s);
    };
    if (!v) return set("empty");
    if (!USERNAME_RE.test(v) || v.includes("__")) return set("invalid");
    set("checking");
    const timer = setTimeout(async () => {
      const { data, error } = await createClient().rpc("username_available", { p_username: v });
      set(error ? "invalid" : (data as { status: UsernameStatus }).status);
    }, 400);
    return () => clearTimeout(timer);
  }, [value]);

  const bad = status === "invalid" || status === "reserved" || status === "taken";
  const tone = status === "available" || status === "current" ? "text-success" : bad ? "text-danger" : "text-ink/65";
  return (
    <div>
      <div className="relative">
        <AtSign size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/65" />
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_@]/g, "").slice(0, 21))}
          autoCapitalize="none"
          autoComplete="username"
          spellCheck={false}
          aria-describedby={`${id}-status`}
          aria-invalid={hasError || bad || undefined}
          className={cn(inputClass(hasError || bad), "pl-9")}
        />
      </div>
      <p id={`${id}-status`} aria-live="polite" className={cn("mt-1 flex items-center gap-1 text-xs", tone)}>
        {status === "checking" && <Loader2 size={13} className="animate-spin" />}
        {(status === "available" || status === "current") && <CheckCircle2 size={13} />}
        {bad && <XCircle size={13} />}
        {t(`username.status.${status}`)}
      </p>
      <p className="mt-0.5 text-xs text-ink/65">{t("username.rules")}</p>
    </div>
  );
}

export function UsernameCard({ username }: { username: string }) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(username);
  const [status, setStatus] = useState<UsernameCheck>("current");
  const [nextChange, setNextChange] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);

  useEffect(() => {
    createClient()
      .rpc("username_available", { p_username: username })
      .then(({ data }) => setNextChange((data as { next_change_at: string | null } | null)?.next_change_at ?? null));
  }, [username]);

  async function save() {
    setError(null);
    if (status !== "available") return;
    if (!window.confirm(t("username.confirmChange", { username: value.replace(/^@/, "") }))) return;
    setSaving(true);
    const { error: e } = await createClient().rpc("set_username", { p_username: value });
    setSaving(false);
    if (e) return setError(friendlyErrorKey(e, "set_username"));
    toast(t("username.changed"));
    router.refresh();
  }

  const locked = Boolean(nextChange && new Date(nextChange) > new Date());
  return (
    <section className="card space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t("username.title")}</h2>
        <Link href={`/u/${username}`} className="text-sm font-medium text-orange-dark">
          {t("social.viewPublicProfile")} →
        </Link>
      </div>
      {locked ? (
        <p className="text-sm text-ink/70">
          @{username} ·{" "}
          {t("username.cooldown", {
            date: new Date(nextChange!).toLocaleDateString(lang === "id" ? "id-ID" : "en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium" }),
          })}
        </p>
      ) : (
        <>
          <UsernameField id="profile-username" value={value} onChange={setValue} onStatus={setStatus} />
          <p className="text-xs text-ink/65">{t("username.changeNote")}</p>
          {error && <Alert>{t(error)}</Alert>}
          <PrimaryButton onClick={save} disabled={status !== "available"} loading={saving} loadingText={t("pin.saving")}>
            {t("username.save")}
          </PrimaryButton>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Social links
// ---------------------------------------------------------------------------

type LinkDraft = { platform: SocialPlatform; raw: string; visibility: Visibility };

export function VisibilitySelect({ id, value, onChange, className }: { id?: string; value: Visibility; onChange: (v: Visibility) => void; className?: string }) {
  const { t } = useLanguage();
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as Visibility)} className={cn("rounded-xl border border-ink/10 bg-surface px-2 py-2 text-sm", className)}>
      {VISIBILITIES.map((v) => (
        <option key={v} value={v}>
          {t(`visibility.${v}`)}
        </option>
      ))}
    </select>
  );
}

export function SocialLinksEditor({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [rows, setRows] = useState<LinkDraft[] | null>(null);
  const [saved, setSaved] = useState<SocialPlatform[]>([]);
  const [adding, setAdding] = useState<SocialPlatform | "">("");
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState<SocialPlatform[]>([]);

  useEffect(() => {
    createClient()
      .from("social_links")
      .select("platform, value, visibility, sort_order")
      .order("sort_order")
      .then(({ data }) => {
        const list = (data ?? []) as (SocialLink & { sort_order: number })[];
        setRows(list.map((l) => ({ platform: l.platform, raw: l.value, visibility: l.visibility })));
        setSaved(list.map((l) => l.platform));
      });
  }, []);

  const unused = SOCIAL_PLATFORMS.filter((p) => !rows?.some((r) => r.platform === p));
  const update = (i: number, patch: Partial<LinkDraft>) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    if (!rows) return;
    const bad = rows.filter((r) => !normalizeSocial(r.platform, r.raw)).map((r) => r.platform);
    setInvalid(bad);
    if (bad.length) return;
    setSaving(true);
    const sb = createClient();
    const keep = rows.map((r) => r.platform);
    const removed = saved.filter((p) => !keep.includes(p));
    const results = await Promise.all([
      removed.length ? sb.from("social_links").delete().eq("user_id", userId).in("platform", removed) : Promise.resolve({ error: null }),
      rows.length
        ? sb.from("social_links").upsert(
            rows.map((r, i) => ({ user_id: userId, platform: r.platform, value: normalizeSocial(r.platform, r.raw)!, visibility: r.visibility, sort_order: i })),
            { onConflict: "user_id,platform" }
          )
        : Promise.resolve({ error: null }),
    ]);
    setSaving(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) return toast(t(friendlyErrorKey(failed.error, "social_links")), "error");
    setSaved(keep);
    setRows(rows.map((r) => ({ ...r, raw: normalizeSocial(r.platform, r.raw)! })));
    toast(t("links.saved"));
  }

  return (
    <section className="card space-y-3 p-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <Link2 size={18} className="text-orange-dark" /> {t("links.title")}
        </h2>
        <p className="mt-1 text-sm text-ink/70">{t("links.desc")}</p>
      </div>
      {!rows ? (
        <div className="skeleton h-24" />
      ) : (
        <>
          {rows.length === 0 && <p className="text-sm text-ink/65">{t("links.empty")}</p>}
          <ul className="space-y-3">
            {rows.map((r, i) => (
              <li key={r.platform} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[8rem_1fr_auto_auto] sm:items-center">
                <label htmlFor={`link-${r.platform}`} className="col-span-2 flex items-center gap-1.5 text-sm font-medium sm:col-span-1">
                  {r.platform === "website" && <Globe size={14} />} {t(`links.platform.${r.platform}`)}
                </label>
                <input
                  id={`link-${r.platform}`}
                  value={r.raw}
                  onChange={(e) => update(i, { raw: e.target.value })}
                  placeholder={t(r.platform === "website" ? "links.websitePlaceholder" : "links.handlePlaceholder")}
                  autoCapitalize="none"
                  spellCheck={false}
                  className={cn(inputClass(invalid.includes(r.platform)), "col-span-2 sm:col-span-1")}
                />
                <VisibilitySelect value={r.visibility} onChange={(v) => update(i, { visibility: v })} className="w-full sm:w-auto" />
                <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="rounded-full p-2 text-ink/65 hover:bg-danger-soft hover:text-danger" aria-label={t("links.remove")}>
                  <Trash2 size={16} />
                </button>
                {invalid.includes(r.platform) && (
                  <p className="col-span-2 text-xs text-danger sm:col-span-4">{t(r.platform === "website" ? "links.invalidWebsite" : "links.invalidHandle")}</p>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            {unused.length > 0 && (
              <>
                <select
                  value={adding}
                  onChange={(e) => setAdding(e.target.value as SocialPlatform)}
                  aria-label={t("links.add")}
                  className="rounded-xl border border-ink/10 bg-surface px-2 py-2 text-sm"
                >
                  <option value="">{t("links.choose")}</option>
                  {unused.map((p) => (
                    <option key={p} value={p}>
                      {t(`links.platform.${p}`)}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!adding}
                  onClick={() => {
                    if (!adding) return;
                    setRows([...rows, { platform: adding, raw: "", visibility: "everyone" }]);
                    setAdding("");
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-ink/10 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  <Plus size={15} /> {t("links.add")}
                </button>
              </>
            )}
            <PrimaryButton onClick={save} loading={saving} loadingText={t("pin.saving")} className="ml-auto">
              {t("links.save")}
            </PrimaryButton>
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

const DEFAULT_PRIVACY: PrivacySettings = {
  profile_visibility: "everyone",
  show_full_name: false,
  show_gender: false,
  show_age: false,
  show_location: true,
  show_activities: true,
  show_friends: "friends",
  friend_requests: "everyone",
  messages: "friends",
  searchable: true,
};

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-ink/65">{hint}</span>}
      </span>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-ink/15 transition after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:bg-orange-deep peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-orange/50"
      />
    </label>
  );
}

function Choice<T extends string>({
  id,
  label,
  hint,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <label htmlFor={id}>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-ink/65">{hint}</span>}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className="rounded-xl border border-ink/10 bg-surface px-3 py-2 text-sm">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PrivacyForm({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [s, setS] = useState<PrivacySettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    createClient()
      .from("privacy_settings")
      .select("profile_visibility, show_full_name, show_gender, show_age, show_location, show_activities, show_friends, friend_requests, messages, searchable")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setS({ ...DEFAULT_PRIVACY, ...(data ?? {}) }));
  }, [userId]);

  if (!s) return <div className="skeleton h-96" />;
  const set = <K extends keyof PrivacySettings>(k: K, v: PrivacySettings[K]) => setS({ ...s, [k]: v });
  const vis = VISIBILITIES.map((v) => ({ value: v, label: t(`visibility.${v}`) }));

  async function save() {
    setSaving(true);
    const { error } = await createClient().from("privacy_settings").upsert({ user_id: userId, ...s }, { onConflict: "user_id" });
    setSaving(false);
    toast(error ? t(friendlyErrorKey(error, "privacy_settings")) : t("privacy.saved"), error ? "error" : "success");
  }

  return (
    <div className="space-y-5">
      <section className="card divide-y divide-ink/5 px-5">
        <Choice id="pv" label={t("privacy.profileVisibility")} hint={t("privacy.profileVisibilityHint")} value={s.profile_visibility} options={vis}
          onChange={(v) => set("profile_visibility", v)} />
        <Toggle id="searchable" label={t("privacy.searchable")} hint={t("privacy.searchableHint")} checked={s.searchable} onChange={(v) => set("searchable", v)} />
        <Choice id="fr" label={t("privacy.friendRequests")} value={s.friend_requests}
          options={[{ value: "everyone", label: t("privacy.fr.everyone") }, { value: "nobody", label: t("privacy.fr.nobody") }]}
          onChange={(v) => set("friend_requests", v)} />
        <Choice id="sf" label={t("privacy.showFriends")} value={s.show_friends} options={vis} onChange={(v) => set("show_friends", v)} />
        <Choice id="msg" label={t("privacy.messages")} hint={t("privacy.messagesHint")} value={s.messages}
          options={[
            { value: "everyone", label: t("visibility.everyone") },
            { value: "friends", label: t("visibility.friends") },
            { value: "nobody", label: t("privacy.fr.nobody") },
          ]}
          onChange={(v) => set("messages", v)} />
      </section>
      <section className="card divide-y divide-ink/5 px-5">
        <p className="py-3 text-sm font-semibold">{t("privacy.onProfile")}</p>
        <Toggle id="sfn" label={t("privacy.showFullName")} hint={t("privacy.showFullNameHint")} checked={s.show_full_name} onChange={(v) => set("show_full_name", v)} />
        <Toggle id="sl" label={t("privacy.showLocation")} hint={t("privacy.showLocationHint")} checked={s.show_location} onChange={(v) => set("show_location", v)} />
        <Toggle id="sg" label={t("privacy.showGender")} checked={s.show_gender} onChange={(v) => set("show_gender", v)} />
        <Toggle id="sa" label={t("privacy.showAge")} checked={s.show_age} onChange={(v) => set("show_age", v)} />
        <Toggle id="sact" label={t("privacy.showActivities")} hint={t("privacy.showActivitiesHint")} checked={s.show_activities}
          onChange={(v) => set("show_activities", v)} />
      </section>
      <p className="text-xs text-ink/65">{t("privacy.neverShown")}</p>
      <PrimaryButton onClick={save} loading={saving} loadingText={t("pin.saving")} className="w-full sm:w-auto">
        {t("privacy.save")}
      </PrimaryButton>
    </div>
  );
}

export function BlockedUsers() {
  const { t } = useLanguage();
  const toast = useToast();
  const [list, setList] = useState<{ user_id: string; username: string; display_name: string }[] | null>(null);

  useEffect(() => {
    createClient()
      .rpc("my_blocked_users")
      .then(({ data }) => setList((data as { user_id: string; username: string; display_name: string }[] | null) ?? []));
  }, []);

  async function unblock(id: string) {
    const { error } = await createClient().rpc("unblock_user", { p_user: id });
    if (error) return toast(t(friendlyErrorKey(error, "unblock_user")), "error");
    setList((l) => l?.filter((x) => x.user_id !== id) ?? null);
    toast(t("social.unblocked"));
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold">{t("privacy.blocked")}</h2>
      <p className="mt-1 text-sm text-ink/70">{t("privacy.blockedHint")}</p>
      {!list ? (
        <div className="skeleton mt-3 h-16" />
      ) : list.length === 0 ? (
        <p className="mt-3 text-sm text-ink/65">{t("privacy.noBlocked")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink/5">
          {list.map((b) => (
            <li key={b.user_id} className="flex items-center gap-3 py-2.5">
              <Avatar name={b.display_name} size={36} />
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">{b.display_name}</span> <span className="text-ink/65">@{b.username}</span>
              </span>
              <button onClick={() => unblock(b.user_id)} className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold">
                {t("social.unblock")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

// Mirrors public._mutable_notification_types() (migration 008); security,
// account, support and join decisions can't be muted.
const MUTABLE_TYPES = [
  "event_comment",
  "comment_reply",
  "join_request",
  "friend_request",
  "friend_accepted",
  "new_message",
  "event_reminder",
  "group_new_event",
  "interest_match",
  "rate_activity",
] as const;

export function NotificationPrefs() {
  const { t } = useLanguage();
  const toast = useToast();
  const [muted, setMuted] = useState<string[] | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const { data } = await sb.from("notification_prefs").select("muted").eq("user_id", user.id).maybeSingle();
      setMuted((data?.muted as string[] | undefined) ?? []);
    });
  }, []);

  async function toggle(type: string, on: boolean) {
    if (!muted || !userId) return;
    const next = on ? muted.filter((m) => m !== type) : [...muted, type];
    setMuted(next);
    const { error } = await createClient().from("notification_prefs").upsert({ user_id: userId, muted: next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) {
      setMuted(muted);
      toast(t(friendlyErrorKey(error, "notification_prefs")), "error");
    }
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold">{t("notifPrefs.title")}</h2>
      <p className="text-sm text-ink/70">{t("notifPrefs.desc")}</p>
      <PushToggle />
      {!muted ? (
        <div className="skeleton mt-3 h-40" />
      ) : (
        <div className="mt-1 divide-y divide-ink/5">
          {MUTABLE_TYPES.map((type) => (
            <Toggle key={type} id={`np-${type}`} label={t(`notifPrefs.${type}`)} checked={!muted.includes(type)} onChange={(v) => toggle(type, v)} />
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-ink/65">{t("notifPrefs.always")}</p>
    </section>
  );
}
