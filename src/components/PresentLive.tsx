"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";

/** Big join QR plus the "going" count, refreshed every 5 seconds (event_attendees). */
export function PresentLive({
  eventId,
  joinUrl,
  max,
  scanLabel,
  goingLabel,
  codeLabel,
  code,
}: {
  eventId: string;
  joinUrl: string;
  max: number;
  scanLabel: string;
  goingLabel: string;
  /** Translated sentence with a \u0000 placeholder where the code goes. */
  codeLabel: string;
  code: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState<number | null>(null);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    let last = -1;
    const load = () =>
      supabase.rpc("event_attendees", { p_event: eventId }).then(({ data }) => {
        const n = (data as { count: number } | null)?.count ?? 0;
        if (last >= 0 && n > last) {
          setBump(true); // a short pop when someone joins
          setTimeout(() => setBump(false), 600);
        }
        last = n;
        setCount(n);
      });
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [supabase, eventId]);

  return (
    <div className="flex flex-col items-center gap-6 md:flex-row md:gap-12">
      <div className="rounded-3xl bg-white p-5 shadow-lift">
        <QRCodeSVG value={joinUrl} size={320} className="h-auto w-[min(70vw,320px)]" />
      </div>
      <div className="space-y-3">
        <p className="text-xl font-semibold md:text-2xl">{scanLabel}</p>
        <p aria-live="polite" className={`text-7xl font-extrabold tabular-nums text-orange-dark transition-transform md:text-8xl ${bump ? "scale-110" : ""}`}>
          {count ?? "–"}
          <span className="text-3xl text-ink/65 tabular-nums md:text-4xl">/{max}</span>
        </p>
        <p className="text-lg text-ink/70">{goingLabel}</p>
        {/* Only the code itself is monospaced (easy to read out and type). */}
        <p className="text-base text-ink/70">
          {codeLabel.split("\u0000")[0]}
          <span className="font-mono font-semibold text-ink">{code}</span>
          {codeLabel.split("\u0000")[1]}
        </p>
      </div>
    </div>
  );
}
