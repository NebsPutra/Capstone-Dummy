"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";
import { toFee } from "@/lib/utils";
import type { EventRecord } from "@/types";

/**
 * Labels that tell newcomers whether an activity is for them: skill level,
 * "Free" and "Every week". Cards skip "All levels" (the default) to stay short; the details
 * page passes showAllLevels.
 */
export function ActivityTags({
  event,
  showAllLevels = false,
}: {
  event: Pick<EventRecord, "skill_level" | "fee" | "series_id">;
  showAllLevels?: boolean;
}) {
  const { t } = useLanguage();
  const level = event.skill_level ?? "all";
  const tags: { label: string; tone: string }[] = [];
  if (level === "beginner") tags.push({ label: t("level.beginner"), tone: "bg-success-soft text-success" });
  if (level === "experienced") tags.push({ label: t("level.experienced"), tone: "bg-muted-soft text-ink/75" });
  if (level === "all" && showAllLevels) tags.push({ label: t("level.all"), tone: "bg-muted-soft text-ink/75" });
  if (toFee(event.fee) === 0) tags.push({ label: t("explore.free"), tone: "bg-orange/10 text-orange-dark" });
  if (event.series_id) tags.push({ label: t("series.weekly"), tone: "bg-info-soft text-info" });
  if (tags.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map(({ label, tone }) => (
        <li key={label} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
          {label}
        </li>
      ))}
    </ul>
  );
}
