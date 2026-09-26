"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, Crop } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { EventCover } from "./EventCover";
import { Alert, PrimaryButton } from "./ui";

const OUT_W = 1920;
const OUT_H = 1080;
const MAX_RAW_BYTES = 15 * 1024 * 1024;

/**
 * 16:9 event banner: pick -> crop (drag + zoom) -> compress to 1920×1080
 * WebP/JPEG in the browser -> upload to Supabase Storage (event-banners).
 * `value` is the public URL stored in events.banner_url.
 */
export function BannerUpload({
  value,
  onChange,
  categoryKey,
  emoji,
  title,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  categoryKey?: string | null;
  emoji?: string | null;
  title: string;
}) {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [frameW, setFrameW] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    if (!img || !frameRef.current) return;
    const ro = new ResizeObserver(([e]) => setFrameW(e.contentRect.width));
    ro.observe(frameRef.current);
    return () => ro.disconnect();
  }, [img]);

  const frameH = (frameW * 9) / 16;
  const base = img ? Math.max(frameW / img.naturalWidth, frameH / img.naturalHeight) : 1;
  const scale = base * zoom;
  const drawW = img ? img.naturalWidth * scale : 0;
  const drawH = img ? img.naturalHeight * scale : 0;
  const clamp = (x: number, y: number) => ({
    x: Math.min(0, Math.max(frameW - drawW, x)),
    y: Math.min(0, Math.max(frameH - drawH, y)),
  });

  // Keep the image covering the frame when zoom or size changes.
  useEffect(() => {
    if (img && frameW) setPos((p) => clamp(p.x, p.y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, frameW, img]);

  function pick(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("banner.errType");
    if (file.size > MAX_RAW_BYTES) return setError("banner.errSize");
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setZoom(1);
      setPos({ x: -1e6, y: -1e6 }); // re-centred by clamp once measured
      requestAnimationFrame(() => {
        const w = frameRef.current?.clientWidth ?? 0;
        const h = (w * 9) / 16;
        const s = Math.max(w / image.naturalWidth, h / image.naturalHeight);
        setPos({ x: (w - image.naturalWidth * s) / 2, y: (h - image.naturalHeight * s) / 2 });
      });
    };
    image.src = url;
  }

  async function apply() {
    if (!img || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUT_W;
      canvas.height = OUT_H;
      const ctx = canvas.getContext("2d")!;
      const f = OUT_W / frameW;
      ctx.drawImage(img, pos.x * f, pos.y * f, drawW * f, drawH * f);
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/webp", 0.82));
      const out = blob ?? (await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85)));
      if (!out) throw new Error("encode failed");

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not signed in");
      const ext = out.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("event-banners")
        .upload(path, out, { contentType: out.type, cacheControl: "31536000" });
      if (upErr) throw upErr;
      onChange(supabase.storage.from("event-banners").getPublicUrl(path).data.publicUrl);
      setImg(null);
    } catch (err) {
      console.error("[komunitas] banner upload:", err);
      setError("banner.errUpload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{t("banner.label")}</span>
        <span className="text-xs text-ink/50">{t("banner.recommend")}</span>
      </div>

      {img ? (
        <div className="space-y-3">
          <div
            ref={frameRef}
            className="relative aspect-video w-full cursor-grab touch-none overflow-hidden rounded-xl bg-ink/10 active:cursor-grabbing"
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              setPos(clamp(drag.current.px + e.clientX - drag.current.x, drag.current.py + e.clientY - drag.current.y));
            }}
            onPointerUp={() => (drag.current = null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{ left: pos.x, top: pos.y, width: drawW, height: drawH }}
            />
          </div>
          <p className="text-xs text-ink/50">{t("banner.cropHint")}</p>
          <label className="flex items-center gap-3 text-sm">
            <span className="shrink-0">{t("banner.zoom")}</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-orange"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setImg(null)}
              className="flex-1 rounded-full border border-ink/10 py-2.5 text-sm font-medium"
            >
              {t("common.cancel")}
            </button>
            <PrimaryButton type="button" onClick={apply} loading={uploading} loadingText={t("banner.uploading")} className="flex-1 py-2.5">
              <Crop size={15} /> {t("banner.apply")}
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-xl">
            <EventCover bannerUrl={value} categoryKey={categoryKey} emoji={emoji} title={title} className="aspect-video" />
          </div>
          {!value && <p className="text-xs text-ink/50">{t("banner.default")}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full border border-orange/30 bg-orange/5 px-4 py-2 text-sm font-medium text-orange-dark transition hover:bg-orange/10 active:scale-[0.97]"
            >
              <ImagePlus size={16} /> {value ? t("banner.replace") : t("banner.upload")}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-red-600"
              >
                <Trash2 size={15} /> {t("banner.remove")}
              </button>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && <Alert>{t(error)}</Alert>}
    </div>
  );
}
