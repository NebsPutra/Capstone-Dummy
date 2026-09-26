"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Empty, PageHeader, Pagination, Select, Table, fmtDateTime } from "@/components/admin/ui";

interface Row { id: string; status: string; joined_at: string; user_id: string; event: { id: string; ref: string; title: string } | null; participant: { username: string; full_name: string | null } | null }
const PAGE = 30;

export default function AdminParticipantsPage() {
  const { t, td, lang } = useLanguage();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let q = createClient()
      .from("event_participants")
      .select("id, status, joined_at, user_id, event:events(id, ref, title), participant:profiles!event_participants_user_id_fkey(username, full_name)", { count: "exact" })
      .order("joined_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (status) q = q.eq("status", status);
    q.then(({ data, count }) => {
      setRows((data ?? []) as unknown as Row[]);
      setTotal(count ?? 0);
    });
  }, [status, page]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("parts.title")} subtitle={t("parts.subtitle")} />
      <Select label={t("col.status")} value={status} onChange={(v) => { setStatus(v); setPage(0); }}
        options={[{ value: "", label: t("common.all") }, ...["approved", "pending", "rejected"].map((s) => ({ value: s, label: td(`participation.${s}`, s) }))]} />
      {!rows ? <div className="skeleton h-64" /> : !rows.length ? <Empty text={t("admin.searchNoResults")} /> : (
        <>
          <Table>
            <thead><tr><th>{t("col.participant")}</th><th>{t("col.event")}</th><th>{t("col.status")}</th><th>{t("col.joinedAt")}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/admin/users/${r.user_id}`} className="hover:text-orange-dark">{r.participant?.full_name ?? r.participant?.username}</Link></td>
                  <td>{r.event && <Link href={`/admin/events/${r.event.id}`} className="hover:text-orange-dark"><span className="font-mono text-xs">{r.event.ref}</span> {r.event.title}</Link>}</td>
                  <td>{td(`participation.${r.status}`, r.status)}</td>
                  <td className="text-xs text-ink/60">{fmtDateTime(r.joined_at, lang)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={PAGE} total={total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
