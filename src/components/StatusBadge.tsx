"use client";

import type { EventStatus } from "@/types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

 const TONE: Record<EventStatus, string> = {
  open: "bg-success-soft text-success",
  almost_full: "bg-warning-soft text-warning",
  full: "bg-danger-soft text-danger",
  ongoing: "bg-info-soft text-info",
  completed: "bg-muted-soft text-muted",
  cancelled: "bg-muted-soft text-muted",
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
      {/* Dot in the badge colour: the state, at a glance. */}
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(`status.${status}`)}
    </span>
  );
}
