"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { EventStatus, ParticipationStatus } from "@/types";
import { useToast } from "./Toast";
import { Alert } from "./ui";

export interface ParticipantRow {
  id: string;
  status: ParticipationStatus;
  joined_at: string;
  participant: { nickname: string | null; full_name: string | null } | null;
}

type RpcResult = PromiseLike<{ error: { message?: string; code?: string } | null }>;

/** Organizer tools: approve / reject requests, remove people, cancel the activity. */
export function OwnerPanel({
  eventId,
  status,
  maxParticipants,
  approvedCount,
  participants,
}: {
  eventId: string;
  status: EventStatus;
  maxParticipants: number;
  approvedCount: number;
  participants: ParticipantRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();
  const { t } = useLanguage();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);

  const pending = participants.filter((p) => p.status === "pending");
  const approved = participants.filter((p) => p.status === "approved");
  const locked = status === "cancelled" || status === "completed";
  const nameOf = (p: ParticipantRow) => p.participant?.nickname || p.participant?.full_name || t("event.someone");

  async function act(id: string, call: () => RpcResult, success: TranslationKey) {
    if (busyId) return; // one action at a time
    setBusyId(id);
    setError(null);
    const { error: rpcError } = await call();
    setBusyId(null);
    if (rpcError) return setError(friendlyErrorKey(rpcError, success));
    toast(t(success));
    router.refresh();
  }

  function setStatus(p: ParticipantRow, next: "approved" | "rejected") {
    act(
      p.id,
      () => supabase.rpc("set_participant_status", { p_participant_id: p.id, p_status: next }),
      next === "approved" ? "event.approved" : "event.rejected"
    );
  }

  function remove(p: ParticipantRow) {
    if (!window.confirm(t("event.removeConfirm", { name: nameOf(p) }))) return;
    act(p.id, () => supabase.rpc("remove_participant", { p_participant_id: p.id }), "event.removed");
  }

  function cancelEvent() {
    if (!window.confirm(t("event.cancelConfirm"))) return;
    act("event", () => supabase.rpc("cancel_event", { p_event_id: eventId }), "event.cancelled");
  }

  return (
    <div className="card space-y-5 p-5">
      <h2 className="font-semibold">{t("event.manage")}</h2>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("event.pendingTitle")}</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-ink/50">{t("event.noPending")}</p>
        ) : (
          pending.map((p) => (
            <Row key={p.id} name={nameOf(p)}>
              <button
                disabled={Boolean(busyId) || locked || approvedCount >= maxParticipants}
                onClick={() => setStatus(p, "approved")}
                className="rounded-full bg-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {t("event.approve")}
              </button>
              <button
                disabled={Boolean(busyId)}
                onClick={() => setStatus(p, "rejected")}
                className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {t("event.reject")}
              </button>
            </Row>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">
          {t("event.participantsTitle", { n: approvedCount, max: maxParticipants })}
        </h3>
        {approved.length === 0 ? (
          <p className="text-sm text-ink/50">{t("event.noParticipants")}</p>
        ) : (
          approved.map((p) => (
            <Row key={p.id} name={nameOf(p)}>
              {!locked && (
                <button
                  disabled={Boolean(busyId)}
                  onClick={() => remove(p)}
                  className="text-xs font-semibold text-red-600 disabled:opacity-50"
                >
                  {t("event.remove")}
                </button>
              )}
            </Row>
          ))
        )}
      </section>

      {error && <Alert>{t(error)}</Alert>}

      {!locked && status !== "ongoing" && (
        <button
          onClick={cancelEvent}
          disabled={Boolean(busyId)}
          className="w-full rounded-full border border-red-200 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {busyId === "event" ? t("event.cancelling") : t("event.cancelEvent")}
        </button>
      )}
    </div>
  );
}

function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-cream-warm px-3 py-2">
      <span className="truncate text-sm font-medium">{name}</span>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}
