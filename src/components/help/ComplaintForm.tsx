"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { COMPLAINT_CATEGORIES, COMPLAINT_SEVERITIES, type ComplaintCategory } from "@/lib/admin";
import { useToast } from "../Toast";
import { Alert, FieldShell, PrimaryButton, focusFirstError, inputClass } from "../ui";

const MAX_FILES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** Upload files into the user's own folder and register them on the complaint. */
export async function uploadComplaintFiles(complaintId: string, files: File[], messageId?: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  for (const f of files) {
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `${user.id}/${complaintId}/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage.from("complaint-attachments").upload(path, f, { contentType: f.type });
    if (error) {
      console.error("[komunitas] attachment upload:", error);
      continue;
    }
    await supabase.rpc("add_complaint_attachment", {
      p_complaint: complaintId,
      p_path: path,
      p_name: f.name,
      p_mime: f.type,
      p_size: f.size,
      p_message: messageId ?? null,
    });
  }
}

export function FilePicker({ files, onChange }: { files: File[]; onChange: (f: File[], skipped: boolean) => void }) {
  const { t } = useLanguage();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={files.length >= MAX_FILES}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 px-4 py-2 text-sm font-medium hover:bg-cream-warm disabled:opacity-50"
      >
        <Paperclip size={15} /> {t("help.attachments")}
      </button>
      <p className="text-xs text-ink/50">{t("help.attachHint")}</p>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-cream-warm px-3 py-1.5 text-xs">
              <span className="truncate">{f.name}</span>
              <button type="button" aria-label={t("banner.remove")} onClick={() => onChange(files.filter((_, j) => j !== i), false)}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={ref}
        type="file"
        multiple
        accept={TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          const ok = picked.filter((f) => TYPES.includes(f.type) && f.size <= MAX_BYTES);
          onChange([...files, ...ok].slice(0, MAX_FILES), ok.length !== picked.length);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function ComplaintForm({
  relatedEvent,
  relatedUserId,
  defaultCategory,
}: {
  relatedEvent?: { id: string; title: string } | null;
  relatedUserId?: string | null;
  defaultCategory?: ComplaintCategory | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useLanguage();
  const busy = useRef(false);

  const [category, setCategory] = useState<string>(defaultCategory ?? (relatedEvent ? "event" : ""));
  const [severity, setSeverity] = useState("MEDIUM");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [skipped, setSkipped] = useState(false);
  const [errors, setErrors] = useState<Record<string, TranslationKey>>({});
  const [error, setError] = useState<TranslationKey | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    const errs: Record<string, TranslationKey> = {};
    if (!category) errs.category = "help.errCategory";
    if (subject.trim().length < 3) errs.subject = "help.errSubject";
    if (description.trim().length < 10) errs.description = "help.errDescription";
    setErrors(errs);
    setError(null);
    if (Object.keys(errs).length) return focusFirstError(["category", "subject", "description"], errs);

    busy.current = true;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("submit_complaint", {
        p_category: category,
        p_subject: subject.trim(),
        p_description: description.trim(),
        p_severity: severity,
        p_contact: contact.trim() || null,
        p_related_event: relatedEvent?.id ?? null,
        p_related_user: relatedUserId ?? null,
        p_anonymous: anonymous,
      });
      if (rpcError || !data) return setError(friendlyErrorKey(rpcError, "submit_complaint"));
      const { id, ref } = data as { id: string; ref: string };
      if (files.length) await uploadComplaintFiles(id, files);
      // Server-side email to the admin inbox; never blocks the user.
      fetch("/api/complaints/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).catch(() => {});
      toast(t("help.submitted", { ref }));
      router.push(`/help/${id}`);
      router.refresh();
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="card space-y-4 p-6">
      <h2 className="text-lg font-semibold">{t("help.newTitle")}</h2>
      {relatedEvent && (
        <p className="rounded-xl bg-cream-warm px-4 py-2.5 text-sm">
          {t("help.relatedEvent")}: <span className="font-semibold">{relatedEvent.title}</span>
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldShell id="category" label={t("help.category")} error={errors.category ? t(errors.category) : null}>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass(Boolean(errors.category))}>
            <option value="">{t("help.selectCategory")}</option>
            {COMPLAINT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`complaint.category.${c}`)}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell id="severity" label={t("help.severity")}>
          <select id="severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className={inputClass()}>
            {COMPLAINT_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {t(`complaint.severity.${s}`)}
              </option>
            ))}
          </select>
        </FieldShell>
      </div>
      <FieldShell id="subject" label={t("help.subject")} error={errors.subject ? t(errors.subject) : null}>
        <input id="subject" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass(Boolean(errors.subject))} />
      </FieldShell>
      <FieldShell
        id="description"
        label={t("help.description")}
        error={errors.description ? t(errors.description) : null}
        hint={`${description.length}/5000`}
      >
        <textarea
          id="description"
          rows={5}
          maxLength={5000}
          value={description}
          placeholder={t("help.descriptionPlaceholder")}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass(Boolean(errors.description))}
        />
      </FieldShell>
      <FieldShell id="contact" label={t("help.contact")}>
        <input
          id="contact"
          maxLength={200}
          value={contact}
          placeholder={t("help.contactPlaceholder")}
          onChange={(e) => setContact(e.target.value)}
          className={inputClass()}
        />
      </FieldShell>
      <FilePicker
        files={files}
        onChange={(f, s) => {
          setFiles(f);
          setSkipped(s);
        }}
      />
      {skipped && <p className="text-xs text-amber-700">{t("help.errFiles")}</p>}
      {(relatedEvent || relatedUserId) && (
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-1 accent-orange" />
          <span>
            {t("help.anonymous")}
            <span className="block text-xs text-ink/50">{t("help.anonymousHint")}</span>
          </span>
        </label>
      )}
      {error && <Alert>{t(error)}</Alert>}
      <PrimaryButton type="submit" className="w-full" loading={loading} loadingText={t("help.submitting")}>
        {t("help.submit")}
      </PrimaryButton>
    </form>
  );
}
