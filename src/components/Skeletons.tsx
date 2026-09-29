"use client";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * Loading placeholders shaped like the real content (see `.skeleton` in globals.css).
 * Each block announces "Loading…" once to screen readers; the shapes are hidden from them.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

function Loading({ children, className }: { children: React.ReactNode; className?: string }) {
  const { t } = useLanguage();
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{t("common.loading")}</span>
      {children}
    </div>
  );
}

/** Mirrors ActivityCard: 16/7 cover, title + badge, three meta lines, footer. */
export function ActivityCardSkeleton() {
  return (
    <div aria-hidden className="card overflow-hidden">
      <div className="skeleton aspect-[16/7] rounded-none" />
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton h-6 w-16 rounded-full" />
        </div>
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-4 w-1/2" />
        <div className="flex justify-between">
          <div className="skeleton h-4 w-2/5" />
          <div className="skeleton h-4 w-1/5" />
        </div>
        <div className="flex justify-between pt-1">
          <div className="skeleton h-4 w-12" />
          <div className="skeleton h-4 w-14" />
        </div>
      </div>
    </div>
  );
}

export function ActivityGridSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <Loading className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        <ActivityCardSkeleton key={i} />
      ))}
    </Loading>
  );
}

/** Page title + subtitle, as used at the top of most app pages. */
export function PageHeaderSkeleton() {
  return (
    <div aria-hidden className="space-y-2">
      <div className="skeleton h-8 w-56" />
      <div className="skeleton h-4 w-72 max-w-full" />
    </div>
  );
}

/** Generic list page (notifications, messages, community, help…). */
export function ListPageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Loading className="space-y-6">
      <PageHeaderSkeleton />
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} aria-hidden className="card flex items-center gap-4 p-4">
            <div className="skeleton h-11 w-11 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-3 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** Pages made of activity sections (dashboard, my activities). */
export function ActivityPageSkeleton() {
  return (
    <Loading className="space-y-8">
      <PageHeaderSkeleton />
      <div className="space-y-4">
        <div aria-hidden className="skeleton h-6 w-44" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <ActivityCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </Loading>
  );
}

/** Mirrors the activity detail page: cover, title, fact grid, description. */
export function ActivityDetailSkeleton() {
  return (
    <Loading className="mx-auto max-w-3xl space-y-6">
      <div aria-hidden className="card overflow-hidden">
        <div className="skeleton aspect-video max-h-80 rounded-none" />
        <div className="space-y-5 p-6">
          <div className="space-y-2">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-7 w-2/3" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton h-4 w-24" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-5/6" />
            <div className="skeleton h-4 w-2/3" />
          </div>
        </div>
      </div>
      <div aria-hidden className="skeleton h-40 w-full rounded-2xl" />
    </Loading>
  );
}
