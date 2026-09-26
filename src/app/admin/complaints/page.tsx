"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { COMPLAINT_CATEGORIES, COMPLAINT_SEVERITIES, COMPLAINT_STATUSES, OPEN_COMPLAINT_STATUSES, type Complaint } from "@/lib/admin";
import { Badge, Empty, PageHeader, Pagination, SearchBox, Select, Table, fmtDateTime } from "@/components/admin/ui";

type Row = Complaint & { reporter: { username: string } | null; assignee: { username: string } | null; event: { ref: string; title: string } | null };
const PAGE = 25;

export default function AdminComplaintsPage() {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("open");
  const [severity, setSeverity] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let q = createClient()
      .from("complaints")
      .select("*, reporter:profiles!complaints_reporter_id_fkey(username), assignee:profiles!complaints_assigned_to_fkey(username), event:events(ref, title)", { count: "exact" })
      .order("last_activity_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (status === "open") q = q.in("status", OPEN_COMPLAINT_STATUSES);
    else if (status) q = q.eq("status", status);
    if (severity) q = q.eq("severity", severity);
    if (category) q = q.eq("category", category);
    const s = search.trim().replace(/[,()*%]/g, " ");
    if (s) q = q.or(`subject.ilike.%${s}%,ref.ilike.%${s}%`);
    q.then(({ data, count }) => {
      setRows((data ?? []) as unknown as Row[]);
      setTotal(count ?? 0);
    });
  }, [search, status, severity, category, page]);

  const reset = (set: (v: string) => void) => (v: string) => { set(v); setPage(0); };
  return (
    <div className="space-y-4">
      <PageHeader title={t("acomp.title")} />
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={search} onChange={reset(setSearch)} placeholder={t("acomp.search")} />
        <Select label={t("col.status")} value={status} onChange={reset(setStatus)}
          options={[{ value: "open", label: `${t("complaint.status.OPEN")}+` }, { value: "", label: t("common.all") }, ...COMPLAINT_STATUSES.map((s) => ({ value: s, label: t(`complaint.status.${s}`) }))]} />
        <Select label={t("col.severity")} value={severity} onChange={reset(setSeverity)}
          options={[{ value: "", label: t("common.all") }, ...COMPLAINT_SEVERITIES.map((s) => ({ value: s, label: t(`complaint.severity.${s}`) }))]} />
        <Select label={t("col.category")} value={category} onChange={reset(setCategory)}
          options={[{ value: "", label: t("filter.allCategories") }, ...COMPLAINT_CATEGORIES.map((c) => ({ value: c, label: t(`complaint.category.${c}`) }))]} />
      </div>
      {!rows ? <div className="skeleton h-64" /> : !rows.length ? <Empty text={t("notif.caughtUp")} /> : (
        <>
          <Table>
            <thead><tr><th>{t("col.ref")}</th><th>{t("col.date")}</th><th>{t("col.user")}</th><th>{t("col.category")}</th><th>{t("col.event")}</th><th>{t("col.severity")}</th><th>{t("col.status")}</th><th>{t("col.assigned")}</th><th>{t("col.updated")}</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap font-mono text-xs"><Link href={`/admin/complaints/${c.id}`} className="hover:text-orange-dark">{c.ref}</Link></td>
                  <td className="text-xs text-ink/60">{fmtDateTime(c.created_at, lang)}</td>
                  <td className="text-xs">{c.is_anonymous ? t("acomp.anonymous") : c.reporter ? `@${c.reporter.username}` : "—"}</td>
                  <td>
                    <Link href={`/admin/complaints/${c.id}`} className="font-medium hover:text-orange-dark">{c.subject}</Link>
                    <span className="block text-xs text-ink/40">{t(`complaint.category.${c.category}`)}</span>
                  </td>
                  <td className="text-xs">{c.event ? c.event.ref : "—"}</td>
                  <td><Badge kind="severity" value={c.severity} label={t(`complaint.severity.${c.severity}`)} /></td>
                  <td><Badge value={c.status} label={t(`complaint.status.${c.status}`)} /></td>
                  <td className="text-xs">{c.assignee ? `@${c.assignee.username}` : t("acomp.unassigned")}</td>
                  <td className="text-xs text-ink/60">{fmtDateTime(c.last_activity_at, lang)}</td>
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
