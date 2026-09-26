"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useToast } from "../Toast";
import { PageHeader, Table } from "./ui";

interface Item { id: string | null; key: string; label: string; emoji: string; is_active: boolean; sort_order: number }

/** CRUD for hobbies (interests) and event categories. Keys are immutable. */
export function TaxonomyManager({ kind }: { kind: "interests" | "categories" }) {
  const { t, td } = useLanguage();
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [tick, setTick] = useState(0);
  const prefix = kind === "interests" ? "interest" : "category";

  useEffect(() => {
    createClient().from(kind).select("id, key, label, emoji, is_active, sort_order").order("sort_order").order("label")
      .then(({ data }) => setItems((data ?? []) as Item[]));
  }, [kind, tick]);

  async function save(it: Item) {
    const { error } = await createClient().rpc(kind === "interests" ? "admin_upsert_interest" : "admin_upsert_category", {
      p_id: it.id, p_key: it.key, p_label: it.label, p_emoji: it.emoji, p_active: it.is_active, p_sort: it.sort_order,
    });
    if (error) return toast(t(friendlyErrorKey(error, "taxonomy")), "error");
    toast(t("taxo.saved"));
    setTick((n) => n + 1);
  }
  const update = (i: number, patch: Partial<Item>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const cell = "w-full rounded-lg border border-ink/10 bg-surface px-2 py-1.5 text-sm";

  return (
    <div className="space-y-4">
      <PageHeader
        title={t(kind === "interests" ? "taxo.hobbies" : "taxo.categories")}
        subtitle={t("taxo.inactiveHint")}
        actions={<button onClick={() => setItems([...items, { id: null, key: "", label: "", emoji: "✨", is_active: true, sort_order: items.length }])}
          className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-white">+ {t("taxo.add")}</button>}
      />
      <Table>
        <thead><tr><th>{t("taxo.emoji")}</th><th>{t("taxo.key")}</th><th>{t("taxo.label")}</th><th>{t("taxo.order")}</th><th>{t("taxo.active")}</th><th /></tr></thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id ?? `new-${i}`}>
              <td className="w-16"><input className={cell} value={it.emoji} onChange={(e) => update(i, { emoji: e.target.value })} /></td>
              <td>{it.id ? <code className="text-xs">{it.key}</code> : <input className={cell} placeholder="snake_case" title={t("taxo.keyHint")} value={it.key} onChange={(e) => update(i, { key: e.target.value })} />}</td>
              <td>
                <input className={cell} value={it.label} onChange={(e) => update(i, { label: e.target.value })} />
                {it.id && <span className="text-xs text-ink/40">{td(`${prefix}.${it.key}`, it.label)}</span>}
              </td>
              <td className="w-20"><input type="number" className={cell} value={it.sort_order} onChange={(e) => update(i, { sort_order: Number(e.target.value) })} /></td>
              <td><input type="checkbox" className="accent-orange" checked={it.is_active} onChange={(e) => update(i, { is_active: e.target.checked })} /></td>
              <td><button disabled={!it.label || (!it.id && !it.key)} onClick={() => save(it)} className="rounded-full bg-orange px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">{t("common.save")}</button></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
