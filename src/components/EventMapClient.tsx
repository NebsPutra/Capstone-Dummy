"use client";

import dynamic from "next/dynamic";

// next/dynamic with ssr:false must live inside a Client Component in
// Next.js 16 — this wrapper exists solely so the server page above it
// can stay a Server Component.
const EventMap = dynamic(() => import("@/components/EventMap").then((m) => m.EventMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[220px] items-center justify-center rounded-xl bg-cream-warm text-sm text-ink/40">
      Loading map...
    </div>
  ),
});

export function EventMapClient(props: { lat: number; lng: number; label: string }) {
  return <EventMap {...props} />;
}
