"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { useToast } from "@/components/Toast";
import { Alert } from "@/components/ui";
import { PageHeader } from "@/components/admin/ui";

interface Setting { key: string; value: unknown }
interface View { id: string; page: string; name: string; filters: Record<string, unknown> }

export default function AdminSettingsPage() {
  const { t } = useLanguage();
  const toast = useToast();
  const sb = createClient();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [views, setViews] = useState<View[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    sb.from("platform_settings").select("key, value").order("key").then(({ data }) => setSettings(data ?? []));
    sb.from("saved_views").select("*").order("created_at").then(({ data }) => setViews(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  async function save(key: string, value: unknown) {
    const { error } = await sb.rpc("admin_set_setting", { p_key: key, p_value: value });
    if (error) return toast(t(friendlyErrorKey(error, "admin_set_setting")), "error");
    toast(t("asettings.saved"));
    setTick((n) => n + 1);
  }

  const flags = (settings.find((s) => s.key === "feature_flags")?.value ?? {}) as Record<string, boolean>;
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t("asettings.title")} />
      <Alert tone="info">{t("asettings.secretsNote")}</Alert>
      <section className="card divide-y divide-ink/5">
        {settings.filter((s) => s.key !== "feature_flags").map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-4 p-4 text-sm">
            <span>{t(`asettings.${s.key}` as TranslationKey)}</span>
            {typeof s.value === "boolean" ? (
              <input type="checkbox" className="h-5 w-5 accent-orange" checked={s.value} onChange={(e) => save(s.key, e.target.checked)} />
            ) : (
              <input type="number" min={1} defaultValue={Number(s.value)} onBlur={(e) => Number(e.target.value) !== Number(s.value) && save(s.key, Number(e.target.value))}
                className="w-24 rounded-lg border border-ink/10 bg-surface px-2 py-1.5 text-right" />
            )}
          </div>
        ))}
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold">{t("asettings.flags")}</h2>
        {Object.entries(flags).map(([k, v]) => (
          <label key={k} className="flex items-center justify-between text-sm">
            {t(`asettings.flag.${k}` as TranslationKey)}
            <input type="checkbox" className="h-5 w-5 accent-orange" checked={v} onChange={(e) => save("feature_flags", { ...flags, [k]: e.target.checked })} />
          </label>
        ))}
      </section>
      <section className="card space-y-2 p-5">
        <h2 className="text-sm font-semibold">{t("savedViews.title")}</h2>
        {views.length === 0 ? <p className="text-sm text-ink/50">{t("savedViews.none")}</p> : views.map((v) => (
          <div key={v.id} className="flex items-center justify-between text-sm">
            <Link href={`${v.page}?${new URLSearchParams(v.filters as Record<string, string>)}`} className="text-orange-dark">{v.name}</Link>
            <button onClick={async () => { await sb.from("saved_views").delete().eq("id", v.id); setTick((n) => n + 1); }} className="text-xs text-red-600">✕</button>
          </div>
        ))}
        <button
          onClick={async () => {
            const name = window.prompt(t("savedViews.name"));
            if (!name) return;
            const page = window.prompt("/admin/…", "/admin/complaints") ?? "/admin";
            const { data: { user } } = await sb.auth.getUser();
            await sb.from("saved_views").insert({ owner_id: user!.id, page, name, filters: {} });
            toast(t("savedViews.saved"));
            setTick((n) => n + 1);
          }}
          className="text-sm font-semibold text-orange-dark"
        >
          + {t("savedViews.save")}
        </button>
      </section>
    </div>
  );
}
