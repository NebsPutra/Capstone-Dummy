"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Avatar } from "./social/People";
import { useToast } from "./Toast";

const SIZE = 512;
const MAX_RAW_BYTES = 15 * 1024 * 1024;
const BUCKET = "avatars";

/**
 * Profile picture: pick an image -> centre-cropped to a 512×512 square and
 * compressed in the browser -> uploaded to "avatars/<user id>/" -> saved in
 * profiles.avatar_url. The previous file is removed. (No crop UI: faces are
 * usually centred; add one like BannerUpload's if people ask.)
 */
export function AvatarUpload({ userId, name, url }: { userId: string; name: string; url: string | null }) {
  const { t } = useLanguage();
  const toast = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const oldPath = url?.split(`/object/public/${BUCKET}/`)[1];

  async function save(next: string | null) {
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ avatar_url: next }).eq("id", userId);
    if (error) throw error;
    if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]); // best effort
    router.refresh();
  }

  async function pick(file: File | undefined) {
    if (!file || busy) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast(t("banner.errType"), "error");
    if (file.size > MAX_RAW_BYTES) return toast(t("banner.errSize"), "error");
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const side = Math.min(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = SIZE;
      canvas
        .getContext("2d")!
        .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
      const blob =
        (await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.85))) ??
        (await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88)));
      if (!blob) throw new Error("encode failed");

      const supabase = createClient();
      const path = `${userId}/${crypto.randomUUID()}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
      if (error) throw error;
      await save(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      toast(t("avatar.saved"));
    } catch (err) {
      console.error("[komunitas] avatar upload:", err);
      toast(t("banner.errUpload"), "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await save(null);
      toast(t("avatar.removed"));
    } catch (err) {
      console.error("[komunitas] avatar remove:", err);
      toast(t("banner.errUpload"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        aria-label={t(url ? "avatar.change" : "avatar.add")}
        className="group relative rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange disabled:opacity-60"
      >
        <Avatar name={name} url={url} size={72} />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-orange-dark text-white group-hover:bg-orange-deep">
          <Camera size={14} aria-hidden />
        </span>
      </button>
      {url && (
        <button type="button" onClick={remove} disabled={busy} className="text-xs text-ink/65 hover:text-orange-dark hover:underline">
          {t("avatar.remove")}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}
