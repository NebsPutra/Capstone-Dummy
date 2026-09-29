"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, BellOff, Flag, MessageCircle, MoreVertical, Send, ShieldBan, Trash2, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { cn, timeAgo } from "@/lib/utils";
import { Avatar } from "../social/People";
import { useToast } from "../Toast";

export type SendBlock = "blocked" | "unavailable" | "friends_only" | "nobody" | null;
export interface ConversationCard {
  id: string;
  last_message_at: string | null;
  muted: boolean;
  archived: boolean;
  other: { id: string; username: string; display_name: string; avatar_url: string | null; active: boolean } | null;
  blocked_by_me: boolean;
  send_block: SendBlock;
  unread: number;
  last: { body: string | null; is_mine: boolean; created_at: string } | null;
}
export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  deleted: boolean;
  created_at: string;
  is_mine: boolean;
}

const MAX = 2000;
const REPORT_REASONS = ["spam", "harassment", "inappropriate", "scam", "other"] as const;

function useRpc() {
  const toast = useToast();
  const { t } = useLanguage();
  return useCallback(
    async <T,>(fn: string, args: Record<string, unknown>): Promise<{ ok: boolean; data: T | null }> => {
      const { data, error } = await createClient().rpc(fn, args);
      if (error) {
        toast(t(friendlyErrorKey(error, fn)), "error");
        return { ok: false, data: null };
      }
      return { ok: true, data: data as T };
    },
    [t, toast]
  );
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

export function MessagesInbox({ activeId, compact }: { activeId?: string; compact?: boolean }) {
  const { t, lang } = useLanguage();
  const rpc = useRpc();
  const [archived, setArchived] = useState(false);
  const [list, setList] = useState<ConversationCard[] | null>(null);

  const load = useCallback(async () => {
    setList((await rpc<ConversationCard[]>("my_conversations", { p_archived: archived })).data ?? []);
  }, [archived, rpc]);

  useEffect(() => {
    load();
  }, [load]);

  // Any message in one of my chats (RLS limits the stream to them) refreshes the list.
  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel("inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [load]);

  return (
    <div className={cn("card flex flex-col overflow-hidden", compact && "h-full")}>
      <div className="flex gap-1 border-b border-ink/5 p-2 text-sm">
        {[false, true].map((a) => (
          <button
            key={String(a)}
            onClick={() => setArchived(a)}
            className={cn("flex-1 rounded-full px-3 py-1.5 font-semibold", archived === a ? "bg-orange-deep text-white" : "text-ink/70 hover:bg-cream-warm")}
          >
            {a ? t("messages.archived") : t("messages.inbox")}
          </button>
        ))}
      </div>
      {!list ? (
        <div className="skeleton m-3 h-40" />
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-ink/65">
          <MessageCircle size={28} className="text-ink/30" />
          {archived ? t("messages.noArchived") : t("messages.empty")}
          {!archived && (
            <Link href="/community?tab=friends" className="font-semibold text-orange-dark">
              {t("messages.findFriends")}
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-ink/5 overflow-y-auto">
          {list.map((c) => (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className={cn("flex items-center gap-3 px-4 py-3 transition hover:bg-cream-warm", activeId === c.id && "bg-orange/5")}
              >
                <Avatar name={c.other?.display_name ?? "?"} url={c.other?.avatar_url} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate", c.unread > 0 ? "font-bold" : "font-semibold")}>{c.other?.display_name ?? t("messages.unknownUser")}</span>
                    {c.last && <span className="shrink-0 text-[11px] text-ink/65">{timeAgo(c.last.created_at, lang)}</span>}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className={cn("truncate text-sm", c.unread > 0 ? "font-medium text-ink" : "text-ink/65")}>
                      {c.last ? `${c.last.is_mine ? `${t("messages.you")}: ` : ""}${c.last.body ?? t("messages.deleted")}` : t("messages.noMessagesYet")}
                    </span>
                    {c.muted && <BellOff size={12} className="shrink-0 text-ink/30" aria-label={t("messages.muted")} />}
                    {c.unread > 0 && (
                      <span className="ml-auto shrink-0 rounded-full bg-orange-deep px-1.5 text-[11px] font-bold leading-5 text-white">{c.unread > 99 ? "99+" : c.unread}</span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat thread
// ---------------------------------------------------------------------------

function dayLabel(iso: string, lang: string, t: (k: TranslationKey) => string) {
  const d = new Date(iso);
  const fmt = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  if (fmt(d) === fmt(new Date())) return t("messages.today");
  if (fmt(d) === fmt(new Date(Date.now() - 86400000))) return t("messages.yesterday");
  return d.toLocaleDateString(lang === "id" ? "id-ID" : "en-GB", { timeZone: "Asia/Jakarta", weekday: "short", day: "numeric", month: "short" });
}

export function ChatThread({ initial, initialMessages }: { initial: ConversationCard; initialMessages: ChatMessage[] }) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const toast = useToast();
  const rpc = useRpc();
  const [card, setCard] = useState(initial);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>("spam");
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const otherId = card.other?.id;

  const markRead = useCallback(() => {
    if (document.visibilityState === "visible") {
      createClient()
        .rpc("mark_conversation_read", { p_conversation: card.id })
        .then(() => {});
    }
  }, [card.id]);

  useEffect(() => {
    markRead();
    router.refresh(); // update the unread badge in the navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  // Realtime: new and changed messages in this chat.
  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel(`chat:${card.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${card.id}` }, (payload) => {
        const row = payload.new as { id?: string; conversation_id: string; sender_id: string; body: string; deleted_at: string | null; created_at: string };
        if (!row?.id) return;
        const msg: ChatMessage = {
          id: row.id,
          conversation_id: row.conversation_id,
          sender_id: row.sender_id,
          body: row.deleted_at ? null : row.body,
          deleted: Boolean(row.deleted_at),
          created_at: row.created_at,
          is_mine: row.sender_id !== otherId,
        };
        setMessages((list) => (list.some((m) => m.id === msg.id) ? list.map((m) => (m.id === msg.id ? msg : m)) : [...list, msg]));
        if (!msg.is_mine) markRead();
      })
      .subscribe();
    const onVisible = () => markRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sb.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [card.id, otherId, markRead]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function loadOlder() {
    const el = scrollRef.current;
    const before = el?.scrollHeight ?? 0;
    const { data } = await rpc<ChatMessage[]>("conversation_messages", {
      p_conversation: card.id,
      p_before: messages[0]?.created_at ?? null,
      p_limit: 50,
    });
    const older = data ?? [];
    setHasMore(older.length >= 50);
    stickToBottom.current = false;
    setMessages((list) => [...older, ...list]);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - before;
    });
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = body.trim();
    if (!text || text.length > MAX || sending) return;
    setSending(true);
    const { ok, data } = await rpc<ChatMessage>("send_message", { p_conversation: card.id, p_body: text });
    setSending(false);
    if (!ok || !data) return;
    setBody("");
    stickToBottom.current = true;
    setMessages((list) => (list.some((m) => m.id === data.id) ? list : [...list, data]));
  }

  async function refreshCard() {
    const { data } = await rpc<ConversationCard>("conversation_detail", { p_conversation: card.id });
    if (data) setCard(data);
  }

  async function prefs(args: { p_muted?: boolean; p_archived?: boolean }, msg: TranslationKey) {
    setMenu(false);
    if ((await rpc("set_conversation_prefs", { p_conversation: card.id, p_muted: null, p_archived: null, ...args })).ok) {
      toast(t(msg));
      if (args.p_archived) router.push("/messages");
      else refreshCard();
    }
  }

  async function toggleBlock() {
    setMenu(false);
    if (!otherId) return;
    if (!card.blocked_by_me && !window.confirm(t("social.blockConfirm"))) return;
    const { ok } = await rpc(card.blocked_by_me ? "unblock_user" : "block_user", { p_user: otherId });
    if (ok) {
      toast(t(card.blocked_by_me ? "social.unblocked" : "social.blocked"));
      refreshCard();
    }
  }

  const blockText: Record<Exclude<SendBlock, null>, TranslationKey> = {
    blocked: "messages.youBlocked",
    unavailable: "messages.unavailable",
    friends_only: "messages.friendsOnly",
    nobody: "messages.notAccepting",
  };

  return (
    <div className="card flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-ink/5 px-3 py-2.5">
        <Link href="/messages" className="rounded-full p-1.5 text-ink/70 hover:bg-cream-warm lg:hidden" aria-label={t("messages.back")}>
          <ArrowLeft size={20} />
        </Link>
        {card.other ? (
          <Link href={`/u/${card.other.username}`} className="flex min-w-0 flex-1 items-center gap-2.5">
            <Avatar name={card.other.display_name} url={card.other.avatar_url} size={38} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{card.other.display_name}</span>
              <span className="block truncate text-xs text-ink/65">@{card.other.username}</span>
            </span>
          </Link>
        ) : (
          <span className="flex-1 font-semibold">{t("messages.unknownUser")}</span>
        )}
        {card.muted && <BellOff size={16} className="text-ink/65" aria-label={t("messages.muted")} />}
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="rounded-full p-2 text-ink/70 hover:bg-cream-warm" aria-label={t("social.more")} aria-expanded={menu}>
            <MoreVertical size={18} />
          </button>
          {menu && (
            <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-ink/10 bg-surface py-1 text-sm shadow-lift">
              {card.other && (
                <Link href={`/u/${card.other.username}`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-cream-warm">
                  <UserRound size={16} /> {t("messages.viewProfile")}
                </Link>
              )}
              <button
                onClick={() => prefs({ p_muted: !card.muted }, card.muted ? "messages.unmutedToast" : "messages.mutedToast")}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-cream-warm"
              >
                <BellOff size={16} /> {card.muted ? t("messages.unmute") : t("messages.mute")}
              </button>
              <button
                onClick={() => prefs({ p_archived: !card.archived }, card.archived ? "messages.unarchivedToast" : "messages.archivedToast")}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-cream-warm"
              >
                <Archive size={16} /> {card.archived ? t("messages.unarchive") : t("messages.archive")}
              </button>
              {card.other && (
                <>
                  <button onClick={toggleBlock} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-red-600 hover:bg-red-50">
                    <ShieldBan size={16} /> {card.blocked_by_me ? t("social.unblock") : t("social.block")}
                  </button>
                  <Link href={`/help?user=${card.other.id}&category=harassment_abuse`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-cream-warm">
                    <Flag size={16} /> {t("messages.reportUser")}
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
      >
        {hasMore && (
          <div className="pb-2 text-center">
            <button onClick={loadOlder} className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink/70 hover:bg-cream-warm">
              {t("messages.loadOlder")}
            </button>
          </div>
        )}
        {messages.length === 0 && <p className="py-10 text-center text-sm text-ink/65">{t("messages.startHint")}</p>}
        {messages.map((m, i) => {
          const day = dayLabel(m.created_at, lang, t);
          const showDay = i === 0 || dayLabel(messages[i - 1].created_at, lang, t) !== day;
          const time = new Date(m.created_at).toLocaleTimeString(lang === "id" ? "id-ID" : "en-GB", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <div key={m.id}>
              {showDay && <p className="py-2 text-center text-[11px] font-medium text-ink/65">{day}</p>}
              <div className={cn("flex", m.is_mine ? "justify-end" : "justify-start")}>
                <button
                  type="button"
                  onClick={() => !m.deleted && setSelected((s) => (s === m.id ? null : m.id))}
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-left text-sm sm:max-w-[70%]",
                    m.deleted
                      ? "border border-dashed border-ink/15 italic text-ink/65"
                      : m.is_mine
                      ? "rounded-br-md bg-orange-deep text-white"
                      : "rounded-bl-md bg-cream-warm text-ink"
                  )}
                >
                  <span className="whitespace-pre-line break-words">{m.deleted ? t("messages.deleted") : m.body}</span>
                  <span className={cn("mt-0.5 block text-right text-[10px]", m.is_mine && !m.deleted ? "text-white/70" : "text-ink/65")}>{time}</span>
                </button>
              </div>
              {selected === m.id && !m.deleted && (
                <div className={cn("mt-1 flex gap-2 text-xs", m.is_mine ? "justify-end" : "justify-start")}>
                  {m.is_mine ? (
                    <button
                      onClick={async () => {
                        if (!window.confirm(t("messages.deleteConfirm"))) return;
                        if ((await rpc("delete_message", { p_message: m.id })).ok) {
                          setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, deleted: true, body: null } : x)));
                          setSelected(null);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-red-200 px-2.5 py-1 font-semibold text-red-600"
                    >
                      <Trash2 size={12} /> {t("messages.delete")}
                    </button>
                  ) : reporting === m.id ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if ((await rpc("report_message", { p_message: m.id, p_reason: reason, p_details: null })).ok) {
                          toast(t("messages.reported"));
                          setReporting(null);
                          setSelected(null);
                        }
                      }}
                      className="flex flex-wrap items-center gap-2 rounded-xl bg-cream-warm p-2"
                    >
                      <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value as typeof reason)}
                        aria-label={t("comments.reportWhy")}
                        className="rounded-lg border border-ink/10 bg-surface px-2 py-1"
                      >
                        {REPORT_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {t(`messages.reason.${r}`)}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="rounded-full bg-orange-deep px-2.5 py-1 font-semibold text-white">
                        {t("comments.sendReport")}
                      </button>
                      <button type="button" onClick={() => setReporting(null)} className="text-ink/70">
                        {t("common.cancel")}
                      </button>
                    </form>
                  ) : (
                    <button onClick={() => setReporting(m.id)} className="inline-flex items-center gap-1 rounded-full border border-ink/10 px-2.5 py-1 font-semibold text-ink/70">
                      <Flag size={12} /> {t("messages.report")}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {card.send_block ? (
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-ink/5 px-4 py-3 text-center text-sm text-ink/70">
          {t(blockText[card.send_block])}
          {card.send_block === "blocked" && (
            <button onClick={toggleBlock} className="font-semibold text-orange-dark">
              {t("social.unblock")}
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-ink/5 p-2.5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={MAX}
            placeholder={t("messages.placeholder")}
            aria-label={t("messages.placeholder")}
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl border border-ink/10 bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-orange"
          />
          <button
            type="submit"
            disabled={!body.trim() || sending}
            aria-label={t("messages.send")}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-orange-deep text-white disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// "Message" button on profiles
// ---------------------------------------------------------------------------

export function MessageButton({ userId, conversationId }: { userId: string; conversationId: string | null }) {
  const { t } = useLanguage();
  const router = useRouter();
  const rpc = useRpc();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (conversationId) return router.push(`/messages/${conversationId}`);
        setBusy(true);
        const { data } = await rpc<string>("start_conversation", { p_user: userId });
        setBusy(false);
        if (data) router.push(`/messages/${data}`);
      }}
      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-ink/10 px-3.5 py-2 text-sm font-semibold transition hover:border-orange disabled:opacity-60"
    >
      <MessageCircle size={16} /> {t("messages.message")}
    </button>
  );
}
