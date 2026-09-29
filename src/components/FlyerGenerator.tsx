"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { CalendarDays, Clock, Download, ImageDown, Loader2, MapPin, Share2, Sparkles, Ticket, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Lang } from "@/lib/i18n/translations";
import { cn, formatFee, formatTimeRange } from "@/lib/utils";
import { LogoMark } from "./Logo";
import { Alert } from "./ui";

// ---------------------------------------------------------------------------
// Flyer templates. Rendered as plain DOM at the final pixel size, previewed
// scaled down, and exported with html-to-image. Colors are fixed hex values
// (not the theme variables) so the image looks the same in light/dark mode.
// ---------------------------------------------------------------------------

export type FlyerFormat = "vertical" | "square" | "landscape";

const SIZES: Record<FlyerFormat, { w: number; h: number }> = {
  vertical: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
  landscape: { w: 1920, h: 1080 },
};

const C = {
  orange: "#F97316",
  light: "#FB923C",
  deep: "#C2410C",
  cream: "#FFF8ED",
  ink: "#292524",
};

export interface FlyerEvent {
  title: string;
  description: string | null;
  eventDate: string;
  startTime: string;
  endTime: string;
  locationName: string;
  fee: number | string;
  maxParticipants: number;
  eventCode: string;
  shareToken: string;
  bannerUrl: string | null;
  categoryLabel: string | null;
  emoji: string | null;
}

function longDate(date: string, lang: Lang) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Shrink long titles so they still fit the title area. */
function titleSize(title: string, sizes: [number, number, number]) {
  if (title.length <= 28) return sizes[0];
  if (title.length <= 55) return sizes[1];
  return sizes[2];
}

const clamp = (lines: number): CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

function Flyer({
  format,
  ev,
  qrUrl,
  showBanner,
  onBannerLoad,
  onBannerError,
}: {
  format: FlyerFormat;
  ev: FlyerEvent;
  qrUrl: string;
  showBanner: boolean;
  onBannerLoad: () => void;
  onBannerError: () => void;
}) {
  const { t, lang } = useLanguage();
  const { w, h } = SIZES[format];
  const pad = format === "square" ? 60 : 72;
  const host = qrUrl.replace(/^https?:\/\//, "").split("/")[0];

  const info = [
    { icon: CalendarDays, text: longDate(ev.eventDate, lang) },
    { icon: Clock, text: formatTimeRange(ev.startTime, ev.endTime) },
    { icon: MapPin, text: ev.locationName },
    { icon: Ticket, text: `${formatFee(ev.fee, lang)} · ${t("flyer.spots", { n: ev.maxParticipants })}` },
  ];

  const infoList = (fontSize: number, gap: number) => (
    <div style={{ display: "flex", flexDirection: "column", gap, flexShrink: 0 }}>
      {info.map(({ icon: Icon, text }, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: fontSize * 0.55 }}>
          <span
            style={{
              flexShrink: 0,
              width: fontSize * 1.6,
              height: fontSize * 1.6,
              borderRadius: 999,
              background: "rgba(255,248,237,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={fontSize * 0.9} color={C.cream} strokeWidth={2.2} />
          </span>
          <span style={{ fontSize, fontWeight: 600, lineHeight: 1.25, ...clamp(1) }}>{text}</span>
        </div>
      ))}
    </div>
  );

  const brand = (size: number) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: size * 0.3 }}>
        <LogoMark size={size} />
        <span style={{ fontSize: size * 0.55, fontWeight: 800, letterSpacing: -0.5 }}>Komunitas</span>
      </div>
      {ev.categoryLabel && (
        <span
          style={{
            background: C.cream,
            color: C.deep,
            fontSize: size * 0.4,
            fontWeight: 700,
            padding: `${size * 0.16}px ${size * 0.38}px`,
            borderRadius: 999,
            whiteSpace: "nowrap",
          }}
        >
          {ev.emoji && <span style={{ marginRight: size * 0.15 }}>{ev.emoji}</span>}
          {ev.categoryLabel}
        </span>
      )}
    </div>
  );

  // Same idea as EventCover: show the whole banner over a blurred copy of it.
  const banner = (style: CSSProperties) => (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 40,
        background: "rgba(255,248,237,0.16)",
        boxShadow: "0 24px 60px -20px rgba(80,20,0,0.45)",
        ...style,
      }}
    >
      {showBanner && ev.bannerUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ev.bannerUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(40px)",
              transform: "scale(1.15)",
              opacity: 0.75,
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ev.bannerUrl}
            alt=""
            crossOrigin="anonymous"
            onLoad={onBannerLoad}
            onError={onBannerError}
            style={{ position: "relative", width: "100%", height: "100%", objectFit: "contain" }}
          />
        </>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, rgba(255,248,237,0.28), rgba(255,248,237,0.06))",
          }}
        >
          <span style={{ fontSize: 180, lineHeight: 1 }}>{ev.emoji ?? "✨"}</span>
        </div>
      )}
    </div>
  );

  const qrCard = (qr: number, codeSize: number, stacked = false) => (
    <div
      style={{
        flexShrink: 0,
        background: C.cream,
        color: C.ink,
        borderRadius: 36,
        padding: qr * 0.12,
        display: "flex",
        flexDirection: stacked ? "column" : "row",
        alignItems: "center",
        gap: qr * 0.14,
        boxShadow: "0 24px 60px -24px rgba(80,20,0,0.5)",
      }}
    >
      <div style={{ background: "#FFFFFF", borderRadius: 20, padding: qr * 0.07, flexShrink: 0 }}>
        <QRCodeSVG value={qrUrl} size={qr} fgColor={C.ink} bgColor="#FFFFFF" level="M" />
      </div>
      <div style={{ minWidth: 0, textAlign: stacked ? "center" : "left" }}>
        <p style={{ fontSize: codeSize * 0.95, fontWeight: 800, color: C.deep, lineHeight: 1.1 }}>{t("flyer.scan")}</p>
        <p style={{ fontSize: codeSize * 0.6, color: "rgba(41,37,36,0.6)", marginTop: codeSize * 0.3 }}>{t("flyer.or")}</p>
        <p style={{ fontSize: codeSize, fontWeight: 800, letterSpacing: 1, lineHeight: 1.2 }}>{ev.eventCode}</p>
        {!stacked && (
          <p style={{ fontSize: codeSize * 0.6, color: "rgba(41,37,36,0.6)", marginTop: codeSize * 0.3 }}>{host}</p>
        )}
      </div>
    </div>
  );

  const title = (sizes: [number, number, number], lines: number) => (
    <h1 style={{ fontSize: titleSize(ev.title, sizes), fontWeight: 800, lineHeight: 1.12, letterSpacing: -1.5, paddingBottom: "0.08em", flexShrink: 0, ...clamp(lines) }}>
      {ev.title}
    </h1>
  );

  // Takes whatever height is left above the QR card (so long titles can't push
  // the card off the flyer) and fades out if the text doesn't fit.
  const description = (fontSize: number, lines: number) => (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        maskImage: "linear-gradient(to bottom, #000 70%, transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, #000 70%, transparent)",
      }}
    >
      {ev.description && (
        <p style={{ fontSize, lineHeight: 1.45, color: "rgba(255,248,237,0.85)", ...clamp(lines) }}>{ev.description}</p>
      )}
    </div>
  );

  const root: CSSProperties = {
    position: "relative",
    width: w,
    height: h,
    overflow: "hidden",
    color: C.cream,
    fontFamily: "var(--font-plus-jakarta), system-ui, sans-serif",
    background: `linear-gradient(150deg, ${C.light} 0%, ${C.orange} 38%, ${C.deep} 100%)`,
  };

  const decor = (
    <>
      <span style={{ position: "absolute", width: 620, height: 620, right: -220, top: -220, borderRadius: 999, background: "rgba(255,255,255,0.10)" }} />
      <span style={{ position: "absolute", width: 420, height: 420, left: -160, bottom: -140, borderRadius: "42%", background: "rgba(255,255,255,0.08)" }} />
    </>
  );

  if (format === "landscape") {
    return (
      <div style={root}>
        {decor}
        <div style={{ position: "relative", display: "flex", height: "100%", padding: pad, gap: 64 }}>
          {banner({ width: 820, height: "100%", flexShrink: 0 })}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 28 }}>
            {brand(64)}
            {title([84, 68, 56], 3)}
            {infoList(32, 18)}
            {description(28, 3)}
            {qrCard(190, 38)}
          </div>
        </div>
      </div>
    );
  }

  if (format === "square") {
    return (
      <div style={root}>
        {decor}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", padding: pad, gap: 28 }}>
          {brand(56)}
          {banner({ width: "100%", height: 360, flexShrink: 0 })}
          {title([66, 54, 46], 2)}
          <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "flex-end", gap: 32 }}>
            <div style={{ flex: 1, minWidth: 0, alignSelf: "center" }}>{infoList(28, 16)}</div>
            {qrCard(170, 26, true)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={root}>
      {decor}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", padding: pad, gap: 40 }}>
        {brand(68)}
        {banner({ width: "100%", height: 527, flexShrink: 0 })}
        {title([92, 74, 60], 3)}
        {infoList(36, 22)}
        {description(32, 5)}
        {qrCard(250, 44)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Button + dialog
// ---------------------------------------------------------------------------

const FORMATS: { key: FlyerFormat; ratio: string }[] = [
  { key: "vertical", ratio: "9 / 16" },
  { key: "square", ratio: "1 / 1" },
  { key: "landscape", ratio: "16 / 9" },
];

/**
 * "Generate flyer to share", shown to the event's creator and to admins.
 * The flyer only uses details the viewer can already see on the page, so
 * gating the button in the UI is enough; nothing new is read from the DB.
 */
export function FlyerGenerator({ event }: { event: FlyerEvent }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-orange/30 bg-orange/5 px-4 py-2 text-sm font-semibold text-orange-dark hover:bg-orange/10"
      >
        <Sparkles size={15} /> {t("flyer.open")}
      </button>
      {open && <FlyerDialog event={event} onClose={() => setOpen(false)} />}
    </>
  );
}

function FlyerDialog({ event, onClose }: { event: FlyerEvent; onClose: () => void }) {
  const { t } = useLanguage();
  const [format, setFormat] = useState<FlyerFormat>("vertical");
  // The dialog only mounts after a click, so `window` is always available here.
  const qrUrl = `${window.location.origin}/join/${event.shareToken}`;
  const canShare = typeof navigator.share === "function";
  const [showBanner, setShowBanner] = useState(!!event.bannerUrl);
  const [bannerReady, setBannerReady] = useState(!event.bannerUrl);
  const [fontsReady, setFontsReady] = useState(false);
  const [busy, setBusy] = useState<null | "png" | "jpg" | "share">(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const frameRef = useRef<HTMLDivElement>(null);
  const flyerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);
  const { w, h } = SIZES[format];

  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  // Fit the full-size flyer into the preview frame.
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const fit = () => {
      const maxH = Math.min(window.innerHeight * 0.5, 560);
      setScale(Math.min(el.clientWidth / w, maxH / h));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h]);

  const skipBanner = useCallback(() => {
    setShowBanner(false);
    setBannerReady(true);
    setNote(t("flyer.bannerSkipped"));
  }, [t]);

  const ready = fontsReady && bannerReady;

  async function render(kind: "png" | "jpg"): Promise<string> {
    const node = flyerRef.current;
    if (!node) throw new Error("flyer not mounted");
    const lib = await import("html-to-image");
    const opts = { width: w, height: h, pixelRatio: 1, cacheBust: true, backgroundColor: C.orange };
    return kind === "png" ? lib.toPng(node, opts) : lib.toJpeg(node, { ...opts, quality: 0.92 });
  }

  /** Render; if the banner is what breaks it (e.g. CORS), retry without it. */
  async function renderSafe(kind: "png" | "jpg"): Promise<string> {
    try {
      return await render(kind);
    } catch (err) {
      if (!showBanner) throw err;
      console.error("[komunitas] flyer render with banner:", err);
      skipBanner();
      await new Promise((r) => setTimeout(r, 50));
      return render(kind);
    }
  }

  const filename = (ext: string) => `komunitas-${event.eventCode}-${format}.${ext}`;

  function save(url: string, name: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  }

  async function download(kind: "png" | "jpg") {
    setBusy(kind);
    setError(null);
    try {
      save(await renderSafe(kind), filename(kind));
    } catch (err) {
      console.error("[komunitas] flyer:", err);
      setError(t("flyer.error"));
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    setError(null);
    try {
      const url = await renderSafe("png");
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], filename("png"), { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: event.title, text: qrUrl });
      } else {
        // Desktop browsers often can't share files: fall back to a download.
        save(url, file.name);
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("[komunitas] flyer share:", err);
        setError(t("flyer.error"));
      }
    } finally {
      setBusy(null);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="flyer-title"
      className="fixed inset-0 z-[900] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[94vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-b-none p-5 sm:rounded-b-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="flyer-title" className="text-lg font-semibold">
              {t("flyer.title")}
            </h2>
            <p className="mt-1 text-sm text-ink/70">{t("flyer.hint")}</p>
          </div>
          <button onClick={onClose} aria-label={t("common.close")} className="text-ink/65">
            <X size={20} />
          </button>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("flyer.size")}</legend>
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map(({ key, ratio }) => (
              <button
                key={key}
                type="button"
                aria-pressed={format === key}
                onClick={() => setFormat(key)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition",
                  format === key ? "border-orange bg-orange/10 text-orange-dark" : "border-ink/10 text-ink/70 hover:bg-cream-warm"
                )}
              >
                <span className="flex h-9 items-center">
                  <span
                    className={cn("block rounded-[4px] border-2", format === key ? "border-orange" : "border-ink/30")}
                    style={{ aspectRatio: ratio, height: key === "landscape" ? "60%" : "100%" }}
                  />
                </span>
                <span className="text-sm font-semibold">{t(`flyer.${key}`)}</span>
                <span className="hidden text-[11px] leading-tight text-ink/65 sm:block">{t(`flyer.${key}Hint`)}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div ref={frameRef} className="flex w-full justify-center">
          <div className="relative overflow-hidden rounded-xl shadow-lift" style={{ width: w * scale, height: h * scale }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: w, height: h }}>
              <div ref={flyerRef}>
                <Flyer
                  format={format}
                  ev={event}
                  qrUrl={qrUrl}
                  showBanner={showBanner}
                  onBannerLoad={() => setBannerReady(true)}
                  onBannerError={skipBanner}
                />
              </div>
            </div>
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-cream/70 text-sm font-medium text-ink/70 backdrop-blur-sm">
                <Loader2 size={16} className="animate-spin" /> {t("flyer.preparing")}
              </div>
            )}
          </div>
        </div>

        {note && <p className="text-xs text-ink/65">{note}</p>}
        {error && <Alert>{error}</Alert>}

        <div className="grid gap-2 sm:grid-cols-3">
          <ActionButton primary disabled={!ready || !!busy} busy={busy === "png"} onClick={() => download("png")}>
            <Download size={16} /> {t("flyer.downloadPng")}
          </ActionButton>
          <ActionButton disabled={!ready || !!busy} busy={busy === "jpg"} onClick={() => download("jpg")}>
            <ImageDown size={16} /> {t("flyer.downloadJpg")}
          </ActionButton>
          {canShare && (
            <ActionButton disabled={!ready || !!busy} busy={busy === "share"} onClick={share}>
              <Share2 size={16} /> {t("flyer.share")}
            </ActionButton>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  busy,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  primary?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition disabled:opacity-50",
        primary ? "bg-orange-deep text-white hover:bg-orange-deeper" : "border border-ink/10 hover:bg-cream-warm"
      )}
    >
      {busy ? (
        <>
          <Loader2 size={16} className="animate-spin" /> {t("flyer.working")}
        </>
      ) : (
        children
      )}
    </button>
  );
}
