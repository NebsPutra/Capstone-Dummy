"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { RANGE_KEYS, SEVERITY_TONE, STATUS_TONE, rangeFor, type DateRange, type RangeKey } from "@/lib/admin";
import { cn } from "@/lib/utils";

/** Call an admin RPC with loading / error state; re-runs when deps change. */
export function useRpc<T>(fn: string, args: Record<string, unknown> | null, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!args) return;
    let cancelled = false;
    setLoading(true);
    createClient()
      .rpc(fn, args)
      .then(({ data: d, error: e }) => {
        if (cancelled) return;
        if (e) setError(friendlyErrorKey(e, fn));
        else {
          setError(null);
          setData(d as T);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload };
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink/60">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  icon,
}: {
  label: string;
  value: number | string | null | undefined;
  delta?: number | null;
  icon?: React.ReactNode;
}) {
  const { t, lang } = useLanguage();
  return (
    <div className="card p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-ink/50">
        <span>{label}</span>
        {icon}
      </div>
      {value === null || value === undefined ? (
        <div className="skeleton mt-2 h-8 w-16" />
      ) : (
        <p className="mt-1 text-2xl font-bold tabular-nums">
          {typeof value === "number" ? value.toLocaleString(lang === "id" ? "id-ID" : "en-US") : value}
        </p>
      )}
      {typeof delta === "number" && (
        <p className={cn("mt-1 flex items-center gap-0.5 text-xs font-medium", delta >= 0 ? "text-green-700" : "text-red-600")}>
          {delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {t("kpi.vsPrev", { pct: `${delta > 0 ? "+" : ""}${delta}%` })}
        </p>
      )}
    </div>
  );
}

export function Badge({ value, label, kind = "status" }: { value: string; label: string; kind?: "status" | "severity" }) {
  const tone = (kind === "severity" ? SEVERITY_TONE : STATUS_TONE)[value] ?? "bg-stone-100 text-stone-500";
  return <span className={cn("inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", tone)}>{label}</span>;
}

export function RangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const { t } = useLanguage();
  const [custom, setCustom] = useState({ from: "", to: "" });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap rounded-full bg-cream-warm p-0.5 text-xs font-semibold">
        {RANGE_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => (k === "custom" ? onChange({ ...value, key: "custom" }) : onChange(rangeFor(k)))}
            className={cn("rounded-full px-3 py-1.5 transition", value.key === k ? "bg-orange text-white shadow-soft" : "text-ink/60 hover:text-ink")}
          >
            {t(`range.${k}` as TranslationKey)}
          </button>
        ))}
      </div>
      {value.key === "custom" && (
        <div className="flex items-center gap-1 text-xs">
          <input type="date" aria-label={t("range.from")} value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="rounded-lg border border-ink/10 bg-surface px-2 py-1" />
          <span>–</span>
          <input type="date" aria-label={t("range.to")} value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="rounded-lg border border-ink/10 bg-surface px-2 py-1" />
          <button
            type="button"
            disabled={!custom.from || !custom.to}
            onClick={() => onChange(rangeFor("custom" as RangeKey, custom))}
            className="rounded-full bg-orange px-3 py-1 font-semibold text-white disabled:opacity-50"
          >
            ✓
          </button>
        </div>
      )}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
      <input
        value={local}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => {
          setLocal(e.target.value);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onChange(e.target.value), 300);
        }}
        className="w-full rounded-full border border-ink/10 bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-orange"
      />
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border border-ink/10 bg-surface px-3 py-2 text-sm outline-none focus:border-orange"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Horizontally scrollable table wrapper for small screens. */
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm [&_td]:px-4 [&_td]:py-2.5 [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-ink/40 [&_tbody_tr]:border-t [&_tbody_tr]:border-ink/5 [&_tbody_tr:hover]:bg-cream-warm/40">
        {children}
      </table>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const { t } = useLanguage();
  const from = total ? page * pageSize + 1 : 0;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-ink/50">{t("page.showing", { from, to, total })}</span>
      <div className="flex gap-2">
        <button disabled={page === 0} onClick={() => onPage(page - 1)} className="rounded-full border border-ink/10 px-3 py-1.5 disabled:opacity-40">
          {t("page.prev")}
        </button>
        <button disabled={to >= total} onClick={() => onPage(page + 1)} className="rounded-full border border-ink/10 px-3 py-1.5 disabled:opacity-40">
          {t("page.next")}
        </button>
      </div>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="card flex flex-col items-center gap-2 p-10 text-center text-sm text-ink/50">
      <span className="text-3xl">🍃</span>
      {text}
    </div>
  );
}

export function fmtDateTime(ts: string | null | undefined, lang: string) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(lang === "id" ? "id-ID" : "en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
