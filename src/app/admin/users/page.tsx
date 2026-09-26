"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { ACCOUNT_STATUSES, ROLES } from "@/lib/admin";
import { Badge, Empty, PageHeader, Pagination, SearchBox, Select, Table, fmtDateTime, useRpc } from "@/components/admin/ui";

interface UserRow {
  id: string; username: string; display_name: string; email: string | null; role: string; account_status: string;
  city: string | null; created_at: string; last_sign_in_at: string | null; events_created: number; events_joined: number; complaints: number;
}

const PAGE = 25;

export default function AdminUsersPage() {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);
  const { data, loading } = useRpc<{ rows: UserRow[]; total: number }>(
    "admin_list_users",
    { p_search: search || null, p_status: status || null, p_role: role || null, p_city: null, p_sort: sort, p_limit: PAGE, p_offset: page * PAGE },
    [search, status, role, sort, page]
  );
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t("ausers.title")} />
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={search} onChange={reset(setSearch)} placeholder={t("ausers.search")} />
        <Select label={t("col.status")} value={status} onChange={reset(setStatus)} options={[{ value: "", label: t("common.all") }, ...ACCOUNT_STATUSES.map((s) => ({ value: s, label: t(`account.status.${s}`) }))]} />
        <Select label={t("col.role")} value={role} onChange={reset(setRole)} options={[{ value: "", label: t("filter.allRoles") }, ...ROLES.map((r) => ({ value: r, label: t(`role.${r}` as TranslationKey) }))]} />
        <Select label="sort" value={sort} onChange={reset(setSort)} options={(["newest", "oldest", "name", "last_active"] as const).map((s) => ({ value: s, label: t(`ausers.sort.${s}`) }))} />
      </div>
      {loading && !data ? (
        <div className="skeleton h-64" />
      ) : !data?.rows.length ? (
        <Empty text={t("admin.searchNoResults")} />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th>{t("col.user")}</th>
                <th>{t("col.email")}</th>
                <th>{t("col.role")}</th>
                <th>{t("col.status")}</th>
                <th>{t("col.city")}</th>
                <th>{t("col.events")}</th>
                <th>{t("col.registered")}</th>
                <th>{t("col.lastActive")}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-orange-dark">
                      {u.display_name}
                    </Link>
                    <span className="block text-xs text-ink/40">@{u.username}</span>
                  </td>
                  <td className="text-ink/70">{u.email}</td>
                  <td>{t(`role.${u.role}` as TranslationKey)}</td>
                  <td>
                    <Badge value={u.account_status} label={t(`account.status.${u.account_status}` as "account.status.active")} />
                  </td>
                  <td className="text-ink/70">{u.city ?? "—"}</td>
                  <td className="tabular-nums">
                    {u.events_created} / {u.events_joined}
                  </td>
                  <td className="text-xs text-ink/60">{fmtDateTime(u.created_at, lang)}</td>
                  <td className="text-xs text-ink/60">{u.last_sign_in_at ? fmtDateTime(u.last_sign_in_at, lang) : t("ausers.never")}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={PAGE} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
