"use client";

import dynamic from "next/dynamic";
import { useLanguage } from "@/lib/i18n/LanguageContext";

function MapLoading() {
  const { t } = useLanguage();
  return (
    <div className="flex h-[220px] items-center justify-center rounded-xl bg-cream-warm text-sm text-ink/40">
      {t("create.loadingMap")}
    </div>
  );
}

// next/dynamic with ssr:false must live inside a Client Component in
// Next.js 16 — this wrapper exists solely so the server page above it
// can stay a Server Component.
const EventMap = dynamic(() => import("@/components/EventMap").then((m) => m.EventMap), {
  ssr: false,
  loading: () => <MapLoading />,
});

export function EventMapClient(props: { lat: number; lng: number; label: string }) {
  return <EventMap {...props} />;
}
