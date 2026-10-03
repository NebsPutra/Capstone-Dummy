"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { isJoinable } from "@/lib/events";
import { formatFee } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { EventParticipant, EventStatus, JoinPermission, ParticipationStatus } from "@/types";
import { useToast } from "./Toast";
import { Alert, PrimaryButton } from "./ui";

/**
 * Join / leave. All rules (capacity with row locking, privacy + invite,
 * approval, cancelled/started events, duplicates) are enforced server-side
 * by join_event() / leave_event(); the UI state here is only a hint.
 */
export function JoinPanel({
  eventId,
  inviteToken,
  joinPermission,
  status,
  isOwner,
  myParticipation,
  fee,
}: {
  eventId: string;
  inviteToken: string | null;
  joinPermission: JoinPermission;
  /** Effective status (see lib/events). */
  status: EventStatus;
  isOwner: boolean;
  myParticipation: EventParticipant | null;
  /** Shown in the phone bar next to the Join button. */
  fee: number | string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();
  const { t, lang } = useLanguage();
  const busy = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  // Phone bar shows only while the regular Join button is off screen.
  const [cardVisible, setCardVisible] = useState(true);
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const io = new IntersectionObserver(([entry]) => setCardVisible(entry.isIntersecting));
    io.observe(card);
    return () => io.disconnect();
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);

  async function run(fn: () => Promise<void>) {
    if (busy.current) return; // double-click protection
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      await fn();
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  function handleJoin() {
    run(async () => {
      const { data, error: rpcError } = await supabase.rpc("join_event", {
        p_event_id: eventId,
        p_token: inviteToken,
      });
      if (rpcError) {
        setError(friendlyErrorKey(rpcError, "join_event"));
        router.refresh(); // e.g. it just became full — show the real state
        return;
      }
      toast((data as ParticipationStatus) === "pending" ? t("join.requested") : t("join.joined"));
      router.refresh();
    });
  }

  function handleLeave() {
    if (!window.confirm(t("join.leaveConfirm"))) return;
    run(async () => {
      const { error: rpcError } = await supabase.rpc("leave_event", { p_event_id: eventId });
      if (rpcError) return setError(friendlyErrorKey(rpcError, "leave_event"));
      toast(t("join.left"));
      router.refresh();
    });
  }

  if (isOwner) {
    return <div className="card p-5 text-center text-sm text-ink/70">{t("join.owner")}</div>;
  }

  const canLeave = status !== "ongoing" && status !== "completed" && status !== "cancelled";

  if (myParticipation && myParticipation.status !== "cancelled") {
    const label: TranslationKey =
      myParticipation.status === "pending"
        ? "join.pending"
        : myParticipation.status === "approved"
        ? "join.approved"
        : "join.rejected";

    return (
      <div className="card space-y-3 p-5 text-center">
        <p className="text-sm font-medium">{t(label)}</p>
        {myParticipation.status !== "rejected" && canLeave && (
          <button
            onClick={handleLeave}
            disabled={loading}
            className="text-sm font-medium text-danger disabled:opacity-60"
          >
            {loading
              ? t("join.leaving")
              : myParticipation.status === "pending"
              ? t("join.cancelRequest")
              : t("join.leave")}
          </button>
        )}
        {error && <Alert>{t(error)}</Alert>}
      </div>
    );
  }

  const joinable = isJoinable(status);
  const blockedLabel: TranslationKey | null =
    status === "full"
      ? "join.full"
      : status === "cancelled"
      ? "join.cancelled"
      : status === "ongoing"
      ? "join.ongoing"
      : status === "completed"
      ? "join.completed"
      : null;

  const label = joinPermission === "open" ? t("join.join") : t("join.request");

  return (
    <div ref={cardRef} className="card space-y-3 p-5">
      {/* Phones: the same action, pinned above the bottom bar while this card is off screen. */}
      {joinable && !cardVisible && (
        <div className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-surface/95 p-2.5 pl-4 shadow-lift backdrop-blur-sm md:hidden">
          <span className="text-sm font-semibold">{formatFee(fee, lang)}</span>
          <PrimaryButton
            onClick={handleJoin}
            loading={loading}
            loadingText={joinPermission === "open" ? t("join.joining") : t("join.requesting")}
            className="px-6 py-2.5"
          >
            {label}
          </PrimaryButton>
        </div>
      )}
      <PrimaryButton
        onClick={handleJoin}
        disabled={!joinable}
        loading={loading}
        loadingText={joinPermission === "open" ? t("join.joining") : t("join.requesting")}
        className="w-full py-3.5"
      >
        {!joinable && blockedLabel ? t(blockedLabel) : label}
      </PrimaryButton>
      {joinable && joinPermission === "approval_required" && (
        <p className="text-center text-xs text-ink/65">{t("join.approvalNote")}</p>
      )}
      {error && (
        <Alert>
          {t(error)}{" "}
          <a href={`/help?event=${eventId}`} className="font-semibold underline">
            {t("help.needHelp")}
          </a>
        </Alert>
      )}
    </div>
  );
}
