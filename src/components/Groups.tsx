"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { friendlyErrorKey } from "@/lib/errors";
import { formatDate } from "@/lib/utils";
import type { Category } from "@/types";
import { Alert, FieldShell, PrimaryButton, inputClass } from "./ui";

export type GroupCard = {
  id: string;
  name: string;
  description: string | null;
  area: string | null;
  member_count: number;
  i_am_member: boolean;
  is_owner: boolean;
  next_activity: string | null;
  category: Pick<Category, "id" | "key" | "label" | "emoji"> | null;
};

/** Groups list + "Create a group" (migration 019). Your groups come first. */
export function Groups() {
  const supabase = useMemo(() => createClient(), []);
  const { t, td, lang } = useLanguage();
  const [groups, setGroups] = useState<GroupCard[] | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("groups_list");
    if (rpcError) return setError(friendlyErrorKey(rpcError, "groups_list"));
    setGroups((data as GroupCard[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const shown = groups?.filter((g) => !q || g.name.toLowerCase().includes(q) || (g.area ?? "").toLowerCase().includes(q));

  return (
    <div className="space-y-4">
      {formOpen ? (
        <NewGroupForm onCancel={() => setFormOpen(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-orange-deep px-5 py-3 text-sm font-semibold text-white shadow-soft hover:bg-orange-deeper"
        >
          <Plus size={18} aria-hidden /> {t("groups.new")}
        </button>
      )}

      {groups && groups.length > 6 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("groups.search")}
          aria-label={t("groups.search")}
          className="w-full rounded-full border border-ink/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-orange"
        />
      )}

      {error ? (
        <div className="space-y-2">
          <Alert>{t(error)}</Alert>
          <button onClick={load} className="text-sm font-semibold text-orange-dark">
            {t("common.retry")}
          </button>
        </div>
      ) : !shown ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-36" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="card px-6 py-10 text-center text-sm text-ink/70">{t("groups.empty")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shown.map((g) => (
            <li key={g.id}>
              <Link
                href={`/groups/${g.id}`}
                className="card block h-full space-y-2 p-5 transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-orange-dark">
                    {g.category ? `${g.category.emoji} ${td(`category.${g.category.key}`, g.category.label)}` : null}
                  </p>
                  {g.i_am_member && (
                    <span className="shrink-0 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
                      {g.is_owner ? t("groups.owner") : t("groups.member")}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold leading-snug">{g.name}</h2>
                {g.description && <p className="line-clamp-2 text-sm text-ink/70">{g.description}</p>}
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink/70">
                  <span className="inline-flex items-center gap-1">
                    <Users size={14} aria-hidden /> {t("groups.members", { n: g.member_count })}
                  </span>
                  {g.area && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={14} aria-hidden /> {g.area}
                    </span>
                  )}
                </p>
                {g.next_activity && (
                  <p className="text-sm font-medium text-ink">
                    {t("groups.nextActivity", { date: formatDate(g.next_activity, lang) })}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewGroupForm({ onCancel }: { onCancel: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { t, td } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<{ name?: string; category?: string }>({});
  const [formError, setFormError] = useState<TranslationKey | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .neq("is_active", false)
      .order("sort_order")
      .then(({ data }) => setCategories(data ?? []));
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 3) next.name = t("groups.form.nameError");
    if (!categoryId) next.category = t("players.form.categoryError");
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setFormError(null);
    const { data, error } = await supabase.rpc("group_create", {
      p_name: name,
      p_description: description,
      p_category: categoryId,
      p_area: area,
    });
    setSaving(false);
    if (error || !data) return setFormError(friendlyErrorKey(error, "group_create"));
    router.push(`/groups/${data}`);
  }

  return (
    <form onSubmit={submit} noValidate className="card space-y-4 p-5">
      <FieldShell id="g-name" label={t("groups.form.name")} error={errors.name}>
        <input
          id="g-name"
          value={name}
          maxLength={60}
          placeholder={t("groups.form.namePlaceholder")}
          onChange={(e) => setName(e.target.value)}
          className={inputClass(Boolean(errors.name))}
        />
      </FieldShell>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldShell id="g-category" label={t("create.category")} error={errors.category}>
          <select
            id="g-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass(Boolean(errors.category))}
          >
            <option value="">{t("create.selectCategory")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {td(`category.${c.key}`, c.label)}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell id="g-area" label={t("players.form.area")}>
          <input
            id="g-area"
            value={area}
            maxLength={80}
            placeholder={t("players.form.areaPlaceholder")}
            onChange={(e) => setArea(e.target.value)}
            className={inputClass()}
          />
        </FieldShell>
      </div>
      <FieldShell id="g-description" label={t("groups.form.description")}>
        <textarea
          id="g-description"
          value={description}
          maxLength={500}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass()}
        />
      </FieldShell>
      {formError && <Alert>{t(formError)}</Alert>}
      <div className="flex gap-2">
        <PrimaryButton type="submit" loading={saving} className="flex-1">
          {t("groups.form.submit")}
        </PrimaryButton>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-ink/10 px-5 text-sm font-medium hover:bg-cream-warm"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

/** Join / leave button on a group page. */
export function GroupMembershipButton({ groupId, isMember }: { groupId: string; isMember: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);

  async function toggle() {
    if (isMember && !window.confirm(t("groups.leaveConfirm"))) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("group_toggle_membership", { p_group: groupId });
    setBusy(false);
    if (rpcError) return setError(friendlyErrorKey(rpcError, "group_toggle_membership"));
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60 ${
          isMember
            ? "border border-ink/10 text-ink/75 hover:bg-cream-warm"
            : "bg-orange-deep text-white shadow-soft hover:bg-orange-deeper"
        }`}
      >
        {isMember ? t("groups.leave") : t("groups.join")}
      </button>
      {error && <Alert>{t(error)}</Alert>}
    </div>
  );
}
