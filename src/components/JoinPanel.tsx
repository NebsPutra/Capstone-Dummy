"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EventParticipant, EventStatus, JoinPermission } from "@/types";

export function JoinPanel({
  eventId,
  joinPermission,
  status,
  isOwner,
  myParticipation,
}: {
  eventId: string;
  joinPermission: JoinPermission;
  status: EventStatus;
  isOwner: boolean;
  myParticipation: EventParticipant | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setLoading(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { error: joinError } = await supabase.from("event_participants").insert({
      event_id: eventId,
      user_id: user.id,
      status: joinPermission === "open" ? "approved" : "pending",
    });

    if (joinError) {
      setError(joinError.message);
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  async function handleCancel() {
    setLoading(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("event_participants")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", user.id);

    router.refresh();
    setLoading(false);
  }

  if (isOwner) {
    return (
      <div className="card p-5 text-center text-sm text-ink/60">
        You&apos;re the organizer of this activity.
      </div>
    );
  }

  if (myParticipation) {
    const label =
      myParticipation.status === "pending"
        ? "Your request is pending organizer approval"
        : myParticipation.status === "approved"
        ? "You're registered for this activity ✅"
        : "Your participation was not approved";

    return (
      <div className="card space-y-3 p-5 text-center">
        <p className="text-sm font-medium">{label}</p>
        {myParticipation.status !== "rejected" && (
          <button
            onClick={handleCancel}
            disabled={loading}
            className="text-sm font-medium text-red-600 disabled:opacity-60"
          >
            {loading ? "Cancelling..." : "Cancel my spot"}
          </button>
        )}
      </div>
    );
  }

  const disabled = status === "full" || status === "completed" || status === "cancelled";

  return (
    <div className="card space-y-2 p-5">
      <button
        onClick={handleJoin}
        disabled={loading || disabled}
        className="w-full rounded-full bg-orange py-3.5 text-sm font-semibold text-white shadow-soft hover:bg-orange-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {disabled
          ? "Activity Full"
          : loading
          ? "Joining..."
          : joinPermission === "open"
          ? "JOIN ACTIVITY"
          : "REQUEST TO JOIN"}
      </button>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
