"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { SocialLink } from "@/lib/social";
import { useToast } from "../Toast";
import { fmtDateTime, useRpc } from "./ui";

interface UserSocial {
  friends: number;
  pending_in: number;
  pending_out: number;
  blocked_by_user: number;
  blocked_by_others: number;
  privacy: Record<string, string | boolean> | null;
  links: SocialLink[];
  username_history: { old: string; new: string; at: string; by: string | null }[];
}

/** Friends, blocks, privacy, links and username history for one user (staff). */
export function UserSocialPanel({ userId, username, canEdit }: { userId: string; username: string; canEdit: boolean }) {
  const { t, lang } = useLanguage();
  const toast = useToast();
  const { data } = useRpc<UserSocial>("admin_user_social", { p_user: userId }, [userId]);
  const [busy, setBusy] = useState(false);

  async function rename() {
    const next = window.prompt(t("asocial.renamePrompt"), username);
    if (!next || next === username) return;
    setBusy(true);
    const { error } = await createClient().rpc("admin_set_username", { p_user: userId, p_username: next });
    setBusy(false);
    if (error) return toast(t(friendlyErrorKey(error, "admin_set_username")), "error");
    toast(t("asocial.renamed"));
    window.location.reload();
  }

  if (!data) return <div className="skeleton h-40" />;
  const privacy = data.privacy ?? {};
  return (
    <section className="card space-y-3 p-5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t("asocial.title")}</h2>
        {canEdit && (
          <button disabled={busy} onClick={rename} className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold">
            {t("asocial.rename")}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <p>{t("asocial.friendships")}: <b>{data.friends}</b></p>
        <p>{t("asocial.pendingInOut")}: <b>{data.pending_in} / {data.pending_out}</b></p>
        <p>{t("asocial.blocksMade")}: <b>{data.blocked_by_user}</b></p>
        <p className={data.blocked_by_others >= 3 ? "text-red-600" : ""}>
          {t("asocial.blockedByOthers")}: <b>{data.blocked_by_others}</b>
        </p>
      </div>
      <p className="text-ink/70">
        {t("privacy.profileVisibility")}: <b>{t(`visibility.${privacy.profile_visibility ?? "everyone"}` as TranslationKey)}</b> · {t("privacy.searchable")}:{" "}
        <b>{privacy.searchable === false ? "—" : "✓"}</b>
      </p>
      {data.links.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {data.links.map((l) => (
            <li key={l.platform} className="rounded-full bg-cream-warm px-3 py-1 text-xs">
              {t(`links.platform.${l.platform}`)}: {l.value} <span className="text-ink/65">({t(`visibility.${l.visibility}`)})</span>
            </li>
          ))}
        </ul>
      )}
      <div>
        <h3 className="pt-1 text-xs font-semibold uppercase text-ink/65">{t("asocial.usernameHistory")}</h3>
        {data.username_history.length === 0 ? (
          <p className="text-ink/65">—</p>
        ) : (
          <ul className="space-y-1">
            {data.username_history.map((h, i) => (
              <li key={i} className="flex flex-wrap gap-2">
                <time className="text-xs text-ink/65">{fmtDateTime(h.at, lang)}</time>
                <span>@{h.old} → @{h.new}</span>
                {h.by && <span className="text-ink/65">({t("asocial.by", { user: `@${h.by}` })})</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Reserved usernames (admins+ can add/remove; moderators read-only). */
export function ReservedUsernames({ canEdit }: { canEdit: boolean }) {
  const { t } = useLanguage();
  const toast = useToast();
  const { data, reload } = useRpc<string[]>("admin_reserved_usernames", {}, []);
  const [name, setName] = useState("");

  async function set(n: string, reserved: boolean) {
    const { error } = await createClient().rpc("admin_set_reserved_username", { p_name: n, p_reserved: reserved });
    if (error) return toast(t(friendlyErrorKey(error, "admin_set_reserved_username")), "error");
    setName("");
    reload();
  }

  return (
    <section className="card space-y-3 p-5">
      <div>
        <h2 className="text-sm font-semibold">{t("asocial.reservedTitle")}</h2>
        <p className="text-xs text-ink/65">{t("asocial.reservedHint")}</p>
      </div>
      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) set(name.trim().toLowerCase(), true);
          }}
          className="flex gap-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("asocial.reservedPlaceholder")}
            aria-label={t("asocial.reservedPlaceholder")}
            className="min-w-0 flex-1 rounded-lg border border-ink/10 bg-surface px-3 py-1.5 text-sm"
          />
          <button className="rounded-full bg-orange-deep px-3 py-1.5 text-sm font-semibold text-white">{t("asocial.reserve")}</button>
        </form>
      )}
      {!data ? (
        <div className="skeleton h-16" />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {data.map((n) => (
            <span key={n} className="inline-flex items-center gap-1 rounded-full bg-cream-warm px-2.5 py-1 text-xs">
              {n}
              {canEdit && (
                <button onClick={() => set(n, false)} className="text-ink/65 hover:text-red-600" aria-label={t("asocial.unreserve", { name: n })}>
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
