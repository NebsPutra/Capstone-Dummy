"use client";

import type { EventStatus } from "@/types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const DOT: Record<EventStatus, string> = {
  open: "🟢",
  almost_full: "🟡",
  full: "🔴",
  ongoing: "🔵",
  completed: "⚪",
  cancelled: "⚫",
};

const TONE: Record<EventStatus, string> = {
  open: "bg-green-50 text-green-700",
  almost_full: "bg-amber-50 text-amber-700",
  full: "bg-red-50 text-red-700",
  ongoing: "bg-blue-50 text-blue-700",
  completed: "bg-stone-100 text-stone-500",
  cancelled: "bg-stone-100 text-stone-500",
};

/** Pass the *effective* status (see effectiveStatus in lib/events). */
export function StatusBadge({ status }: { status: EventStatus }) {
  const { t } = useLanguage();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        TONE[status]
      )}
    >
      <span aria-hidden>{DOT[status]}</span>
      {t(`status.${status}`)}
    </span>
  );
}
