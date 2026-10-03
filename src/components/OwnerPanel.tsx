"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
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
  checked_in_at: string | null;
  participant: { nickname: string | null; username: string } | null;
}

type RpcResult = PromiseLike<{ error: { message?: string; code?: string } | null }>;

/**
 * Organizer tools: approve / reject requests, remove people, take attendance
 * (ticks or a QR code people scan), message everyone, cancel the activity.
 */
export function OwnerPanel({
  eventId,
  status,
  maxParticipants,
  approvedCount,
  participants,
  attendanceOpen,
  qrOpen,
  waitlistLength,
}: {
  eventId: string;
  status: EventStatus;
  maxParticipants: number;
  approvedCount: number;
  participants: ParticipantRow[];
  /** From 1 hour before the start until 2 days after the end (set_attendance). */
  attendanceOpen: boolean;
  /** From 1 hour before the start until 1 hour after the end (check_in). */
  qrOpen: boolean;
  waitlistLength: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();
  const { t } = useLanguage();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const pending = participants.filter((p) => p.status === "pending");
  const approved = participants.filter((p) => p.status === "approved");
  const locked = status === "cancelled" || status === "completed";
  const nameOf = (p: ParticipantRow) => p.participant?.nickname || (p.participant?.username ? `@${p.participant.username}` : t("event.someone"));

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

  function setPresent(p: ParticipantRow, present: boolean) {
    act(p.id, () => supabase.rpc("set_attendance", { p_participant_id: p.id, p_present: present }), "checkin.saved");
  }

  async function showQr() {
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("checkin_code", { p_event: eventId });
    if (rpcError) return setError(friendlyErrorKey(rpcError, "checkin_code"));
    setQrCode(data as string);
  }

  async function sendMessage() {
    if (sending || !message.trim()) return;
    setSending(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("message_participants", { p_event: eventId, p_message: message });
    setSending(false);
    if (rpcError) return setError(friendlyErrorKey(rpcError, "message_participants"));
    setMessage("");
    toast(t("owner.messageSent", { n: (data as number) ?? 0 }));
  }

  const checkedIn = approved.filter((p) => p.checked_in_at).length;
  const qrUrl = qrCode && typeof window !== "undefined" ? `${window.location.origin}/activities/${eventId}/checkin?c=${qrCode}` : "";

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
          <p className="text-sm text-ink/65">{t("event.noPending")}</p>
        ) : (
          pending.map((p) => (
            <Row key={p.id} name={nameOf(p)}>
              <button
                disabled={Boolean(busyId) || locked || approvedCount >= maxParticipants}
                onClick={() => setStatus(p, "approved")}
                className="rounded-full bg-orange-deep px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
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
          {attendanceOpen && approved.length > 0 && (
            <span className="ml-2 font-normal text-ink/65">{t("checkin.count", { n: checkedIn, total: approved.length })}</span>
          )}
        </h3>
        {waitlistLength > 0 && <p className="text-sm text-ink/70">{t("owner.waitlist", { n: waitlistLength })}</p>}
        {approved.length === 0 ? (
          <p className="text-sm text-ink/65">{t("event.noParticipants")}</p>
        ) : (
          approved.map((p) => (
            <Row key={p.id} name={nameOf(p)}>
              {attendanceOpen && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={Boolean(p.checked_in_at)}
                    disabled={Boolean(busyId)}
                    onChange={(e) => setPresent(p, e.target.checked)}
                    className="h-4 w-4 accent-orange"
                  />
                  {t("checkin.present")}
                </label>
              )}
              {!locked && (
                <button
                  disabled={Boolean(busyId)}
                  onClick={() => remove(p)}
                  className="text-xs font-semibold text-danger disabled:opacity-50"
                >
                  {t("event.remove")}
                </button>
              )}
            </Row>
          ))
        )}
      </section>

      {qrOpen && approved.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("checkin.qrTitle")}</h3>
          {qrCode ? (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-4 text-center text-stone-800">
              <QRCodeSVG value={qrUrl} size={200} />
              <p className="text-sm">{t("checkin.qrHelp")}</p>
              <p className="font-mono text-lg font-bold tracking-widest">{qrCode}</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={showQr}
              className="w-full rounded-full border border-ink/10 py-2.5 text-sm font-semibold hover:bg-cream-warm"
            >
              {t("checkin.showQr")}
            </button>
          )}
        </section>
      )}

      {!locked && (approved.length > 0 || pending.length > 0) && (
        <section className="space-y-2">
          <label htmlFor="owner-message" className="text-sm font-semibold">
            {t("owner.messageTitle")}
          </label>
          <textarea
            id="owner-message"
            value={message}
            maxLength={300}
            rows={2}
            placeholder={t("owner.messagePlaceholder")}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-xl border border-ink/10 bg-surface px-3 py-2 text-sm outline-none focus:border-orange"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={sending || !message.trim()}
            className="rounded-full bg-orange-deep px-5 py-2 text-sm font-semibold text-white hover:bg-orange-deeper disabled:opacity-50"
          >
            {sending ? t("owner.sending") : t("owner.send")}
          </button>
        </section>
      )}

      {error && <Alert>{t(error)}</Alert>}

      {!locked && status !== "ongoing" && (
        <button
          onClick={cancelEvent}
          disabled={Boolean(busyId)}
          className="w-full rounded-full border border-danger/25 py-2.5 text-sm font-semibold text-danger hover:bg-danger-soft disabled:opacity-60"
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
