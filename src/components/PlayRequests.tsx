"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, MapPin, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { friendlyErrorKey } from "@/lib/errors";
import type { Category } from "@/types";
import { Alert, FieldShell, PrimaryButton, inputClass } from "./ui";
import { useToast } from "./Toast";

type PlayRequest = {
  id: string;
  title: string;
  note: string | null;
  area: string | null;
  players_needed: number;
  players_in: number;
  i_am_in: boolean;
  is_mine: boolean;
  category: Pick<Category, "id" | "key" | "label" | "emoji">;
  creator: { username: string; display_name: string };
};

/**
 * "Looking for players" (migration 018): post a request, others tap "Me too";
 * when enough people are in, the poster creates the activity from it and the
 * interested players get a notification.
 */
export function PlayRequests() {
  const supabase = useMemo(() => createClient(), []);
  const { t, td } = useLanguage();
  const toast = useToast();
  const [requests, setRequests] = useState<PlayRequest[] | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("play_requests_list");
    if (rpcError) return setError(friendlyErrorKey(rpcError, "play_requests_list"));
    setRequests((data as PlayRequest[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(r: PlayRequest) {
    setBusyId(r.id);
    const { error: rpcError } = await supabase.rpc("play_request_toggle", { p_request: r.id });
    setBusyId(null);
    if (rpcError) return toast(t(friendlyErrorKey(rpcError, "play_request_toggle")), "error");
    load();
  }

  async function close(r: PlayRequest) {
    if (!window.confirm(t("players.closeConfirm"))) return;
    setBusyId(r.id);
    const { error: rpcError } = await supabase.rpc("play_request_close", { p_request: r.id });
    setBusyId(null);
    if (rpcError) return toast(t(friendlyErrorKey(rpcError, "play_request_close")), "error");
    load();
  }

  return (
    <div className="space-y-4">
      {formOpen ? (
        <NewRequestForm
          onCancel={() => setFormOpen(false)}
          onCreated={() => {
            setFormOpen(false);
            toast(t("players.posted"));
            load();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-orange-deep px-5 py-3 text-sm font-semibold text-white shadow-soft hover:bg-orange-deeper"
        >
          <Plus size={18} aria-hidden /> {t("players.new")}
        </button>
      )}

      {error ? (
        <div className="space-y-2">
          <Alert>{t(error)}</Alert>
          <button onClick={load} className="text-sm font-semibold text-orange-dark">
            {t("common.retry")}
          </button>
        </div>
      ) : requests === null ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-32" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <p className="card px-6 py-10 text-center text-sm text-ink/70">{t("players.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => {
            const missing = Math.max(0, r.players_needed - r.players_in);
            const createHref = `/create?request=${r.id}&title=${encodeURIComponent(r.title)}&category=${r.category.id}`;
            return (
              <li key={r.id} className="card space-y-3 p-5">
                <div>
                  <p className="text-sm font-medium text-orange-dark">
                    {r.category.emoji} {td(`category.${r.category.key}`, r.category.label)}
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold leading-snug">{r.title}</h2>
                  <p className="text-sm text-ink/70">
                    {r.is_mine ? t("players.yours") : t("players.by", { name: r.creator.display_name })}
                    {r.area && (
                      <>
                        {" · "}
                        <MapPin size={13} className="inline -translate-y-px" aria-hidden /> {r.area}
                      </>
                    )}
                  </p>
                  {r.note && <p className="mt-2 whitespace-pre-line text-sm text-ink/75">{r.note}</p>}
                </div>
                <p className={`text-sm font-semibold ${missing === 0 ? "text-success" : "text-ink"}`}>
                  {t("players.count", { in: r.players_in, total: r.players_needed })}
                  {" · "}
                  {missing === 0 ? t("players.ready") : t("players.needMore", { n: missing })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {r.is_mine ? (
                    <>
                      <Link
                        href={createHref}
                        className="rounded-full bg-orange-deep px-5 py-2 text-sm font-semibold text-white hover:bg-orange-deeper"
                      >
                        {t("players.createActivity")}
                      </Link>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => close(r)}
                        className="inline-flex items-center gap-1 rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-cream-warm disabled:opacity-60"
                      >
                        <X size={15} aria-hidden /> {t("players.close")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => toggle(r)}
                      aria-pressed={r.i_am_in}
                      className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60 ${
                        r.i_am_in
                          ? "bg-success-soft text-success hover:opacity-80"
                          : "bg-orange-deep text-white hover:bg-orange-deeper"
                      }`}
                    >
                      {r.i_am_in ? (
                        <>
                          <Check size={15} aria-hidden /> {t("players.imIn")}
                        </>
                      ) : (
                        t("players.meToo")
                      )}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NewRequestForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const { t, td } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [players, setPlayers] = useState(4);
  const [area, setArea] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ title?: string; category?: string; players?: string }>({});
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
    if (title.trim().length < 3) next.title = t("players.form.titleError");
    if (!categoryId) next.category = t("players.form.categoryError");
    if (!Number.isInteger(players) || players < 2 || players > 30) next.players = t("players.form.playersError");
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setFormError(null);
    const { error } = await supabase.rpc("play_request_create", {
      p_category: categoryId,
      p_title: title,
      p_note: note,
      p_area: area,
      p_players: players,
    });
    setSaving(false);
    if (error) return setFormError(friendlyErrorKey(error, "play_request_create"));
    onCreated();
  }

  return (
    <form onSubmit={submit} noValidate className="card space-y-4 p-5">
      <FieldShell id="pr-title" label={t("players.form.title")} error={errors.title}>
        <input
          id="pr-title"
          value={title}
          maxLength={80}
          placeholder={t("players.form.titlePlaceholder")}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass(Boolean(errors.title))}
        />
      </FieldShell>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldShell id="pr-category" label={t("create.category")} error={errors.category}>
          <select
            id="pr-category"
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
        <FieldShell id="pr-players" label={t("players.form.players")} error={errors.players}>
          <input
            id="pr-players"
            type="number"
            min={2}
            max={30}
            value={players}
            onChange={(e) => setPlayers(Number(e.target.value))}
            className={inputClass(Boolean(errors.players))}
          />
        </FieldShell>
      </div>
      <FieldShell id="pr-area" label={t("players.form.area")}>
        <input
          id="pr-area"
          value={area}
          maxLength={80}
          placeholder={t("players.form.areaPlaceholder")}
          onChange={(e) => setArea(e.target.value)}
          className={inputClass()}
        />
      </FieldShell>
      <FieldShell id="pr-note" label={t("players.form.note")}>
        <textarea
          id="pr-note"
          value={note}
          maxLength={300}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass()}
        />
      </FieldShell>
      {formError && <Alert>{t(formError)}</Alert>}
      <div className="flex gap-2">
        <PrimaryButton type="submit" loading={saving} className="flex-1">
          {t("players.form.submit")}
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
