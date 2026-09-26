"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useToast } from "./Toast";

/** Approve / reject a pending join request (Notifications page). */
export function RequestActions({ participantId }: { participantId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();
  const { t } = useLanguage();
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);

  async function decide(status: "approved" | "rejected") {
    if (busy) return;
    setBusy(status);
    const { error } = await supabase.rpc("set_participant_status", {
      p_participant_id: participantId,
      p_status: status,
    });
    setBusy(null);
    if (error) {
      toast(t(friendlyErrorKey(error, "set_participant_status")), "error");
      return;
    }
    toast(status === "approved" ? t("event.approved") : t("event.rejected"));
    router.refresh();
  }

  return (
    <div className="flex shrink-0 gap-2">
      <button
        onClick={() => decide("approved")}
        disabled={Boolean(busy)}
        className="rounded-full bg-orange px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {busy === "approved" ? "…" : t("event.approve")}
      </button>
      <button
        onClick={() => decide("rejected")}
        disabled={Boolean(busy)}
        className="rounded-full border border-ink/10 px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {busy === "rejected" ? "…" : t("event.reject")}
      </button>
    </div>
  );
}
