"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { PageHeader, useRpc } from "@/components/admin/ui";

type Item = { id: string; label: string; ref?: string; count?: number };
type DQ = Record<string, Item[] | number>;

export default function AdminDataQualityPage() {
  const { t } = useLanguage();
  const { data } = useRpc<DQ>("admin_data_quality", {}, []);
  const lists: { key: string; href: (i: Item) => string }[] = [
    { key: "incomplete_profiles", href: (i) => `/admin/users/${i.id}` },
    { key: "profiles_without_location", href: (i) => `/admin/users/${i.id}` },
    { key: "invalid_coordinates", href: (i) => `/admin/events/${i.id}` },
    { key: "duplicate_events", href: (i) => `/admin/events/${i.id}` },
    { key: "inactive_organizer_events", href: (i) => `/admin/events/${i.id}` },
    { key: "events_without_banner", href: (i) => `/admin/events/${i.id}` },
  ];
  return (
    <div className="space-y-4">
      <PageHeader title={t("dq.title")} subtitle={t("dq.subtitle")} />
      {!data ? <div className="skeleton h-64" /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card flex items-center justify-between p-5 text-sm">
            <span>{t("dq.orphan_auth_users")}</span>
            <span className={`text-2xl font-bold ${(data.orphan_auth_users as number) > 0 ? "text-red-600" : ""}`}>{data.orphan_auth_users as number}</span>
          </section>
          {lists.map(({ key, href }) => {
            const items = (data[key] as Item[]) ?? [];
            return (
              <section key={key} className="card space-y-2 p-5">
                <h2 className="flex items-center justify-between text-sm font-semibold">
                  {t(`dq.${key}` as TranslationKey)}
                  <span className="rounded-full bg-cream-warm px-2 py-0.5 text-xs">{items.length}</span>
                </h2>
                {items.length === 0 ? <p className="text-sm text-ink/50">✅ {t("dq.none")}</p> : (
                  <ul className="max-h-60 space-y-1 overflow-auto text-sm">
                    {items.map((i) => (
                      <li key={i.id}><Link href={href(i)} className="hover:text-orange-dark">{i.ref ? <span className="font-mono text-xs">{i.ref} </span> : null}{i.label}{i.count ? ` ×${i.count}` : ""}</Link></li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
