"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EyeOff, Flag, MessageSquare, MoreHorizontal, Pencil, Pin, Reply, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { cn, timeAgo } from "@/lib/utils";
import { Avatar } from "./social/People";
import { useToast } from "./Toast";

interface CommentAuthor { id: string; username: string; display_name: string; avatar_url: string | null; is_organizer: boolean }
interface Comment {
  id: string;
  parent_id: string | null;
  body: string | null;
  status: "visible" | "hidden" | "deleted";
  pinned: boolean;
  created_at: string;
  edited: boolean;
  author: CommentAuthor | null;
  is_mine: boolean;
  can_edit: boolean;
  can_delete: boolean;
  reported_by_me: boolean;
  report_count: number | null;
  moderation_reason: string | null;
  replies?: Comment[];
}
interface Thread {
  comments: Comment[];
  count: number;
  comments_enabled: boolean;
  can_post: boolean;
  blocked_reason: "incomplete" | "cancelled" | "disabled" | "blocked" | null;
  is_moderator: boolean;
}

const MAX = 1000;
const REPORT_REASONS = ["spam", "harassment", "inappropriate", "misinformation", "other"] as const;

function useRpc() {
  const toast = useToast();
  const { t } = useLanguage();
  return useCallback(
    async (fn: string, args: Record<string, unknown>): Promise<boolean> => {
      const { error } = await createClient().rpc(fn, args);
      if (error) toast(t(friendlyErrorKey(error, fn)), "error");
      return !error;
    },
    [t, toast]
  );
}

function Composer({
  onSubmit,
  placeholder,
  autoFocus,
  initial = "",
  submitLabel,
  onCancel,
}: {
  onSubmit: (body: string) => Promise<boolean>;
  placeholder: string;
  autoFocus?: boolean;
  initial?: string;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const { t } = useLanguage();
  const [body, setBody] = useState(initial);
  const [busy, setBusy] = useState(false);
  const trimmed = body.trim();

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!trimmed || trimmed.length > MAX || busy) return;
    setBusy(true);
    const ok = await onSubmit(trimmed);
    setBusy(false);
    if (ok) setBody("");
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={body}
        autoFocus={autoFocus}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
        }}
        rows={autoFocus ? 2 : 3}
        maxLength={MAX + 50}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full resize-y rounded-xl border border-ink/10 bg-surface px-3 py-2 text-sm outline-none focus:border-orange"
      />
      <div className="flex items-center justify-end gap-2">
        <span className={cn("mr-auto text-xs", trimmed.length > MAX ? "text-danger" : "text-ink/65")}>
          {trimmed.length}/{MAX}
        </span>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-full px-3 py-1.5 text-sm font-medium text-ink/70">
            {t("common.cancel")}
          </button>
        )}
        <button
          type="submit"
          disabled={!trimmed || trimmed.length > MAX || busy}
          className="rounded-full bg-orange-deep px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? t("comments.posting") : submitLabel}
        </button>
      </div>
    </form>
  );
}

function CommentItem({ c, thread, eventId, reload, isReply }: { c: Comment; thread: Thread; eventId: string; reload: () => void; isReply?: boolean }) {
  const { t, lang } = useLanguage();
  const toast = useToast();
  const rpc = useRpc();
  const [mode, setMode] = useState<"view" | "edit" | "reply" | "report">("view");
  const [menu, setMenu] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>("spam");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const act = async (fn: string, args: Record<string, unknown>, msg?: TranslationKey) => {
    setMenu(false);
    if (await rpc(fn, args)) {
      if (msg) toast(t(msg));
      reload();
    }
  };

  const placeholder =
    c.status === "deleted" ? t("comments.deleted") : c.status === "hidden" && c.body === null ? t("comments.hiddenPlaceholder") : null;
  const moderate = thread.is_moderator;
  const showMenu = c.status !== "deleted" && (c.can_delete || moderate || (!c.is_mine && !c.reported_by_me));

  return (
    <li id={`comment-${c.id}`} className="scroll-mt-24 target:rounded-xl target:bg-orange/5">
      <div className="flex gap-3 py-3">
        {c.author ? (
          <Link href={`/u/${c.author.username}`} className="shrink-0">
            <Avatar name={c.author.display_name} url={c.author.avatar_url} size={isReply ? 30 : 36} />
          </Link>
        ) : (
          <span className="h-9 w-9 shrink-0 rounded-full bg-ink/10" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            {c.author && (
              <Link href={`/u/${c.author.username}`} className="font-semibold hover:text-orange-dark">
                {c.author.display_name}
              </Link>
            )}
            {c.author?.is_organizer && (
              <span className="rounded-full bg-orange/15 px-2 py-0.5 text-[10px] font-semibold text-orange-dark">{t("comments.organizer")}</span>
            )}
            {c.pinned && (
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-orange-dark">
                <Pin size={12} /> {t("comments.pinned")}
              </span>
            )}
            <span className="text-xs text-ink/65">
              {timeAgo(c.created_at, lang)}
              {c.edited && ` · ${t("comments.edited")}`}
            </span>
            {c.status === "hidden" && c.body !== null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-semibold text-danger">
                <EyeOff size={11} /> {t("comments.hidden")}
                {c.moderation_reason && ` · ${c.moderation_reason === "auto: reports" ? t("comments.autoHidden") : c.moderation_reason}`}
              </span>
            )}
            {moderate && (c.report_count ?? 0) > 0 && (
              <span className="text-[10px] font-semibold text-danger">{t("comments.reports", { n: c.report_count ?? 0 })}</span>
            )}
          </div>

          {mode === "edit" ? (
            <div className="mt-1">
              <Composer
                initial={c.body ?? ""}
                autoFocus
                placeholder={t("comments.editPlaceholder")}
                submitLabel={t("comments.save")}
                onCancel={() => setMode("view")}
                onSubmit={async (body) => {
                  const ok = await rpc("edit_event_comment", { p_comment: c.id, p_body: body });
                  if (ok) {
                    setMode("view");
                    reload();
                  }
                  return ok;
                }}
              />
            </div>
          ) : placeholder ? (
            <p className="mt-0.5 text-sm italic text-ink/65">{placeholder}</p>
          ) : (
            <p className={cn("mt-0.5 whitespace-pre-line break-words text-sm leading-relaxed", c.status === "hidden" && "text-ink/65")}>{c.body}</p>
          )}

          {mode === "view" && c.status !== "deleted" && (
            <div className="mt-1 flex items-center gap-3 text-xs font-medium text-ink/65">
              {!isReply && thread.can_post && c.status === "visible" && (
                <button onClick={() => setMode("reply")} className="inline-flex items-center gap-1 hover:text-orange-dark">
                  <Reply size={13} /> {t("comments.reply")}
                </button>
              )}
              {c.can_edit && (
                <button onClick={() => setMode("edit")} className="inline-flex items-center gap-1 hover:text-orange-dark">
                  <Pencil size={13} /> {t("comments.edit")}
                </button>
              )}
              {showMenu && (
                <div ref={menuRef} className="relative">
                  <button onClick={() => setMenu((m) => !m)} className="rounded-full p-1 hover:bg-cream-warm" aria-label={t("social.more")} aria-expanded={menu}>
                    <MoreHorizontal size={15} />
                  </button>
                  {menu && (
                    <div className="absolute left-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-ink/10 bg-surface py-1 text-sm shadow-lift">
                      {moderate && c.status === "visible" && !isReply && (
                        <button
                          onClick={() => act("moderate_event_comment", { p_comment: c.id, p_action: c.pinned ? "unpin" : "pin", p_reason: null })}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-cream-warm"
                        >
                          <Pin size={15} /> {c.pinned ? t("comments.unpin") : t("comments.pin")}
                        </button>
                      )}
                      {moderate && !c.is_mine && (
                        <button
                          onClick={() => {
                            if (c.status === "hidden") {
                              act("moderate_event_comment", { p_comment: c.id, p_action: "unhide", p_reason: null }, "comments.unhidden");
                              return;
                            }
                            const why = window.prompt(t("comments.hideReason"));
                            if (why === null) return setMenu(false);
                            act("moderate_event_comment", { p_comment: c.id, p_action: "hide", p_reason: why }, "comments.hiddenToast");
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-cream-warm"
                        >
                          <EyeOff size={15} /> {c.status === "hidden" ? t("comments.unhide") : t("comments.hide")}
                        </button>
                      )}
                      {c.is_mine && (
                        <button
                          onClick={() => {
                            if (window.confirm(t("comments.deleteConfirm"))) act("delete_event_comment", { p_comment: c.id }, "comments.deletedToast");
                            else setMenu(false);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-danger hover:bg-danger-soft"
                        >
                          <Trash2 size={15} /> {t("comments.delete")}
                        </button>
                      )}
                      {!c.is_mine && !c.reported_by_me && c.status === "visible" && (
                        <button
                          onClick={() => {
                            setMenu(false);
                            setMode("report");
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-cream-warm"
                        >
                          <Flag size={15} /> {t("comments.report")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === "report" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await rpc("report_event_comment", { p_comment: c.id, p_reason: reason, p_details: null })) {
                  toast(t("comments.reported"));
                  setMode("view");
                  reload();
                }
              }}
              className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-cream-warm p-2 text-sm"
            >
              <label htmlFor={`reason-${c.id}`} className="font-medium">
                {t("comments.reportWhy")}
              </label>
              <select
                id={`reason-${c.id}`}
                value={reason}
                onChange={(e) => setReason(e.target.value as typeof reason)}
                className="rounded-lg border border-ink/10 bg-surface px-2 py-1"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`comments.reason.${r}`)}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-full bg-orange-deep px-3 py-1 font-semibold text-white">
                {t("comments.sendReport")}
              </button>
              <button type="button" onClick={() => setMode("view")} className="px-2 text-ink/70">
                {t("common.cancel")}
              </button>
            </form>
          )}

          {mode === "reply" && (
            <div className="mt-2">
              <Composer
                autoFocus
                placeholder={t("comments.replyPlaceholder", { name: c.author?.display_name ?? "" })}
                submitLabel={t("comments.reply")}
                onCancel={() => setMode("view")}
                onSubmit={async (body) => {
                  const ok = await rpc("post_event_comment", { p_event: eventId, p_body: body, p_parent: c.id });
                  if (ok) {
                    setMode("view");
                    reload();
                  }
                  return ok;
                }}
              />
            </div>
          )}

          {c.replies && c.replies.length > 0 && (
            <ul className="mt-1 border-l-2 border-ink/5 pl-3">
              {c.replies.map((r) => (
                <CommentItem key={r.id} c={r} thread={thread} eventId={eventId} reload={reload} isReply />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

export function EventComments({ eventId, isOwner }: { eventId: string; isOwner: boolean }) {
  const { t } = useLanguage();
  const rpc = useRpc();
  const [thread, setThread] = useState<Thread | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await createClient().rpc("event_comments_list", { p_event: eventId });
    if (error) {
      console.error("[komunitas] event_comments_list:", error.message);
      setFailed(true);
      return;
    }
    setThread(data as Thread);
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  // Scroll to #comment-… when arriving from a notification.
  useEffect(() => {
    if (!thread || !window.location.hash.startsWith("#comment-")) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [thread]);

  if (failed) return null;
  const blocked: Record<string, TranslationKey> = {
    incomplete: "comments.cantIncomplete",
    cancelled: "comments.cantCancelled",
    disabled: "comments.cantDisabled",
    blocked: "comments.cantBlocked",
  };

  return (
    <section id="comments" className="card space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <MessageSquare size={18} className="text-orange-dark" /> {t("comments.title")}
          {thread && thread.count > 0 && <span className="text-sm font-normal text-ink/65">({thread.count})</span>}
        </h2>
        {isOwner && thread && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink/70">
            <input
              type="checkbox"
              className="h-4 w-4 accent-orange"
              checked={thread.comments_enabled}
              onChange={async (e) => {
                if (await rpc("set_event_comments_enabled", { p_event: eventId, p_enabled: e.target.checked })) load();
              }}
            />
            {t("comments.allow")}
          </label>
        )}
      </div>

      {!thread ? (
        <div className="skeleton h-24" />
      ) : (
        <>
          {thread.can_post ? (
            <Composer
              placeholder={t("comments.placeholder")}
              submitLabel={t("comments.post")}
              onSubmit={async (body) => {
                const ok = await rpc("post_event_comment", { p_event: eventId, p_body: body, p_parent: null });
                if (ok) load();
                return ok;
              }}
            />
          ) : (
            thread.blocked_reason && <p className="rounded-xl bg-cream-warm px-4 py-2.5 text-sm text-ink/70">{t(blocked[thread.blocked_reason])}</p>
          )}
          {thread.comments.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink/65">{t("comments.empty")}</p>
          ) : (
            <ul className="divide-y divide-ink/5">
              {thread.comments.map((c) => (
                <CommentItem key={c.id} c={c} thread={thread} eventId={eventId} reload={load} />
              ))}
            </ul>
          )}
          <p className="text-xs text-ink/65">{t("comments.guidelines")}</p>
        </>
      )}
    </section>
  );
}
