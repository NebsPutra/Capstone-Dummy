"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useToast } from "./Toast";

/** Admin moderation: cancel an event (cancel_event() checks the admin role server-side). */
export function AdminCancelButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (busy || !window.confirm(t("event.cancelConfirm"))) return;
    setBusy(true);
    const { error } = await supabase.rpc("cancel_event", { p_event_id: eventId });
    setBusy(false);
    if (error) {
      toast(t(friendlyErrorKey(error, "cancel_event")), "error");
      return;
    }
    toast(t("event.cancelled"));
    router.refresh();
  }

  return (
    <button onClick={cancel} disabled={busy} className="text-xs font-semibold text-red-600 disabled:opacity-50">
      {busy ? t("event.cancelling") : t("admin.cancel")}
    </button>
  );
}
