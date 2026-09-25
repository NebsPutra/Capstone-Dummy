import { STATUS_LABEL, type EventStatus } from "@/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: EventStatus }) {
  const info = STATUS_LABEL[status];
  const tone =
    status === "open"
      ? "bg-green-50 text-green-700"
      : status === "almost_full"
      ? "bg-amber-50 text-amber-700"
      : status === "full"
      ? "bg-red-50 text-red-700"
      : status === "ongoing"
      ? "bg-blue-50 text-blue-700"
      : "bg-stone-100 text-stone-500";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tone
      )}
    >
      <span>{info.dot}</span>
      {info.label}
    </span>
  );
}
