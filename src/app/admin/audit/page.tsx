"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Empty, PageHeader, Pagination, Select, Table, fmtDateTime } from "@/components/admin/ui";

interface Row { id: number; actor_id: string | null; actor_role: string | null; action: string; entity: string; entity_id: string | null; old_value: unknown; new_value: unknown; metadata: unknown; created_at: string; actor: { username: string } | null }
const PAGE = 50;
const ACTIONS = ["admin_login", "user_updated", "user_suspended", "user_restored", "user_deactivated", "user_anonymized", "role_changed", "user_interests_changed",
  "event_updated", "event_cancelled", "event_restored", "banner_replaced", "participant_added", "participant_removed", "participant_updated",
  "complaint_updated", "complaint_replied", "complaint_note_added", "setting_changed", "data_exported", "chart_exported", "dashboard_exported",
  "hobby_created", "hobby_updated", "category_created", "category_updated"];

export default function AdminAuditPage() {
  const { t, lang } = useLanguage();
  const [action, setAction] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    // RLS: only admins can read; nobody can modify (append-only trigger).
    let q = createClient().from("audit_logs").select("*, actor:profiles!audit_logs_actor_id_fkey(username)", { count: "exact" })
      .order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (action) q = q.eq("action", action);
    q.then(({ data, count }) => { setRows((data ?? []) as unknown as Row[]); setTotal(count ?? 0); });
  }, [action, page]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("audit.title")} subtitle={t("audit.subtitle")} />
      <Select label={t("col.action")} value={action} onChange={(v) => { setAction(v); setPage(0); }}
        options={[{ value: "", label: t("audit.allActions") }, ...ACTIONS.map((a) => ({ value: a, label: a }))]} />
      {!rows ? <div className="skeleton h-64" /> : !rows.length ? <Empty text={t("admin.noActivity")} /> : (
        <>
          <Table>
            <thead><tr><th>{t("col.time")}</th><th>{t("col.actor")}</th><th>{t("col.action")}</th><th>{t("col.entity")}</th><th>{t("col.changes")}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-xs text-ink/60">{fmtDateTime(r.created_at, lang)}</td>
                  <td className="text-xs">{r.actor ? `@${r.actor.username}` : "system"}<span className="block text-ink/40">{r.actor_role}</span></td>
                  <td className="font-medium">{r.action}</td>
                  <td className="text-xs">{r.entity}<span className="block font-mono text-ink/40">{r.entity_id?.slice(0, 8)}</span></td>
                  <td className="max-w-md">
                    <code className="block break-all text-xs text-ink/60">
                      {r.old_value ? `${JSON.stringify(r.old_value)} → ` : ""}{r.new_value ? JSON.stringify(r.new_value) : r.metadata ? JSON.stringify(r.metadata) : ""}
                    </code>
                  </td>
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
