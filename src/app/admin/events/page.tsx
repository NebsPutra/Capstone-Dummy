"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { formatFee } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { Empty, PageHeader, Pagination, SearchBox, Select, Table, useRpc } from "@/components/admin/ui";
import type { EventStatus } from "@/types";

interface EventRow {
  id: string; ref: string; title: string; event_date: string; start_time: string; phase: EventStatus; privacy: string; fee: number;
  max_participants: number; participant_count: number; location_name: string;
  category: { key: string; label: string; emoji: string } | null; organizer: { id: string; username: string; name: string | null } | null; open_complaints: number;
}
const PAGE = 25;

export default function AdminEventsPage() {
  const { t, td, lang } = useLanguage();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [cats, setCats] = useState<{ id: string; key: string; label: string }[]>([]);
  const { data, loading, reload } = useRpc<{ rows: EventRow[]; total: number }>(
    "admin_list_events",
    { p_search: search || null, p_status: status || null, p_category: category || null, p_limit: PAGE, p_offset: page * PAGE },
    [search, status, category, page]
  );
  useEffect(() => {
    createClient().from("categories").select("id, key, label").then(({ data: c }) => setCats(c ?? []));
  }, []);

  async function bulkCancel() {
    if (!selected.length || !window.confirm(t("aevents.bulkConfirm", { n: selected.length }))) return;
    const { data: n, error } = await createClient().rpc("admin_bulk_cancel_events", { p_ids: selected });
    if (error) return toast(t(friendlyErrorKey(error, "bulk cancel")), "error");
    toast(t("aevents.bulkDone", { n: Number(n) }));
    setSelected([]);
    reload();
  }

  const rows = data?.rows ?? [];
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("aevents.title")}
        actions={
          selected.length > 0 && (
            <button onClick={bulkCancel} className="rounded-full border border-red-200 bg-surface px-4 py-2 text-sm font-semibold text-red-600">
              {t("aevents.bulkCancel", { n: selected.length })}
            </button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder={t("aevents.search")} />
        <Select label={t("filter.status")} value={status} onChange={(v) => { setStatus(v); setPage(0); }}
          options={[{ value: "", label: t("filter.allStatuses") }, ...["open", "almost_full", "full", "ongoing", "completed", "cancelled"].map((s) => ({ value: s, label: td(`status.${s}`, s) }))]} />
        <Select label={t("filter.category")} value={category} onChange={(v) => { setCategory(v); setPage(0); }}
          options={[{ value: "", label: t("filter.allCategories") }, ...cats.map((c) => ({ value: c.id, label: td(`category.${c.key}`, c.label) }))]} />
      </div>
      {loading && !data ? (
        <div className="skeleton h-64" />
      ) : !rows.length ? (
        <Empty text={t("admin.searchNoResults")} />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" aria-label={t("aevents.selectAll")} className="accent-orange"
                    checked={rows.every((r) => selected.includes(r.id))}
                    onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])} />
                </th>
                <th>{t("col.ref")}</th>
                <th>{t("col.event")}</th>
                <th>{t("col.date")}</th>
                <th>{t("col.organizer")}</th>
                <th>{t("col.participants")}</th>
                <th>{t("admin.colFee")}</th>
                <th>{t("col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    <input type="checkbox" aria-label={e.title} className="accent-orange" checked={selected.includes(e.id)}
                      onChange={() => setSelected(selected.includes(e.id) ? selected.filter((x) => x !== e.id) : [...selected, e.id])} />
                  </td>
                  <td className="whitespace-nowrap font-mono text-xs">{e.ref}</td>
                  <td>
                    <Link href={`/admin/events/${e.id}`} className="font-medium hover:text-orange-dark">
                      {e.category?.emoji} {e.title}
                    </Link>
                    {e.open_complaints > 0 && <span className="ml-2 text-xs text-red-600">⚠ {t("aevents.openComplaints", { n: e.open_complaints })}</span>}
                    <span className="block text-xs text-ink/40">{e.location_name}{e.privacy === "private" ? ` · ${t("privacy.private")}` : ""}</span>
                  </td>
                  <td className="whitespace-nowrap text-xs">{e.event_date} {e.start_time.slice(0, 5)}</td>
                  <td className="text-xs">{e.organizer ? <Link href={`/admin/users/${e.organizer.id}`} className="hover:text-orange-dark">@{e.organizer.username}</Link> : "—"}</td>
                  <td className="tabular-nums">{e.participant_count}/{e.max_participants}</td>
                  <td className="whitespace-nowrap">{formatFee(e.fee, lang)}</td>
                  <td><StatusBadge status={e.phase} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={PAGE} total={data!.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
