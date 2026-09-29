"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Flag, MoreHorizontal, Search, ShieldBan, UserCheck, UserPlus, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import type { PersonCard, Relationship } from "@/lib/social";
import { useToast } from "../Toast";

export function Avatar({ name, url, size = 44 }: { name: string; url?: string | null; size?: number }) {
  const initial = (name.replace(/^@/, "").trim()[0] ?? "?").toUpperCase();
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-orange-deep font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </span>
  );
}

/** Calls a social RPC and shows errors as toasts. Resolves to { ok, data }. */
function useSocialRpc() {
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

const btn = "inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition disabled:opacity-60";

/** Add / requested / accept-decline / friends / unblock, depending on the relationship. */
export function FriendButton({
  userId,
  relationship,
  acceptsRequests = true,
  onChange,
}: {
  userId: string;
  relationship: Relationship;
  acceptsRequests?: boolean;
  onChange?: (next: Relationship) => void;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const rpc = useSocialRpc();
  const [rel, setRel] = useState(relationship);
  const [busy, setBusy] = useState(false);
  useEffect(() => setRel(relationship), [relationship]);

  async function act(fn: string, args: Record<string, unknown>, next: Relationship | ((d: unknown) => Relationship), msg?: string) {
    if (busy) return;
    setBusy(true);
    const { ok, data } = await rpc<unknown>(fn, args);
    setBusy(false);
    if (!ok) return;
    const value = typeof next === "function" ? next(data) : next;
    setRel(value);
    onChange?.(value);
    if (msg) toast(msg);
  }

  if (rel === "self" || rel === "unavailable") return null;
  if (rel === "blocked") {
    return (
      <button disabled={busy} onClick={() => act("unblock_user", { p_user: userId }, "none", t("social.unblocked"))} className={cn(btn, "border border-ink/10")}>
        {t("social.unblock")}
      </button>
    );
  }
  if (rel === "friends") {
    return (
      <button
        disabled={busy}
        onClick={() => window.confirm(t("social.unfriendConfirm")) && act("remove_friend", { p_user: userId }, "none", t("social.unfriended"))}
        className={cn(btn, "group border border-green-200 bg-green-50 text-green-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600")}
        title={t("social.unfriend")}
      >
        <UserCheck size={16} />
        <span className="group-hover:hidden">{t("social.friends")}</span>
        <span className="hidden group-hover:inline">{t("social.unfriend")}</span>
      </button>
    );
  }
  if (rel === "incoming") {
    return (
      <span className="inline-flex gap-2">
        <button disabled={busy} onClick={() => act("respond_friend_request", { p_user: userId, p_accept: true }, "friends", t("social.accepted"))} className={cn(btn, "bg-orange-deep text-white hover:bg-orange-deeper")}>
          <Check size={16} /> {t("social.accept")}
        </button>
        <button disabled={busy} onClick={() => act("respond_friend_request", { p_user: userId, p_accept: false }, "none")} className={cn(btn, "border border-ink/10")} aria-label={t("social.decline")}>
          <X size={16} />
          <span className="hidden sm:inline">{t("social.decline")}</span>
        </button>
      </span>
    );
  }
  if (rel === "outgoing") {
    return (
      <button disabled={busy} onClick={() => act("remove_friend", { p_user: userId }, "none")} className={cn(btn, "border border-ink/10 text-ink/70")} title={t("social.cancelRequest")}>
        {t("social.requested")}
      </button>
    );
  }
  if (!acceptsRequests) return <span className="text-xs text-ink/65">{t("social.notAccepting")}</span>;
  return (
    <button
      disabled={busy}
      onClick={() => act("send_friend_request", { p_user: userId }, (d) => (d === "friends" ? "friends" : "outgoing"), t("social.requestSent"))}
      className={cn(btn, "bg-orange-deep text-white hover:bg-orange-deeper")}
    >
      <UserPlus size={16} /> {t("social.addFriend")}
    </button>
  );
}

export function PersonRow({ person, onChange }: { person: PersonCard; onChange?: (next: Relationship) => void }) {
  const { t, td } = useLanguage();
  const sub = [`@${person.username}`, person.city].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-3 py-3">
      <Link href={`/u/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={person.display_name} url={person.avatar_url} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{person.display_name}</span>
          <span className="block truncate text-xs text-ink/65">{sub}</span>
          {(person.mutual > 0 || person.primary_interest) && (
            <span className="block truncate text-xs text-ink/65">
              {person.primary_interest && `${person.primary_interest.emoji ?? ""} ${td(`interest.${person.primary_interest.key}`, person.primary_interest.label)}`}
              {person.primary_interest && person.mutual > 0 && " · "}
              {person.mutual > 0 && t("social.mutual", { n: person.mutual })}
            </span>
          )}
        </span>
      </Link>
      <FriendButton userId={person.user_id} relationship={person.relationship} onChange={onChange} />
    </li>
  );
}

function PeopleList({ people, empty, onChange }: { people: PersonCard[] | null; empty: string; onChange?: (p: PersonCard, next: Relationship) => void }) {
  if (!people) return <div className="skeleton h-40" />;
  if (people.length === 0) return <p className="py-6 text-center text-sm text-ink/65">{empty}</p>;
  return (
    <ul className="divide-y divide-ink/5">
      {people.map((p) => (
        <PersonRow key={p.user_id} person={p} onChange={(next) => onChange?.(p, next)} />
      ))}
    </ul>
  );
}

/** Friend / block / report actions on a public profile. */
export function ProfileActions({
  userId,
  relationship,
  acceptsRequests,
}: {
  userId: string;
  relationship: Relationship;
  acceptsRequests: boolean;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const toast = useToast();
  const rpc = useSocialRpc();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function block() {
    setOpen(false);
    if (!window.confirm(t("social.blockConfirm"))) return;
    if (!(await rpc("block_user", { p_user: userId })).ok) return;
    toast(t("social.blocked"));
    router.refresh();
  }

  if (relationship === "self") {
    return (
      <Link href="/profile" className={cn(btn, "border border-ink/10")}>
        {t("social.editProfile")}
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FriendButton userId={userId} relationship={relationship} acceptsRequests={acceptsRequests} onChange={() => router.refresh()} />
      {relationship !== "blocked" && (
        <div ref={menuRef} className="relative">
          <button onClick={() => setOpen((o) => !o)} className={cn(btn, "border border-ink/10 px-2.5")} aria-label={t("social.more")} aria-expanded={open}>
            <MoreHorizontal size={18} />
          </button>
          {open && (
            <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-ink/10 bg-surface py-1 text-sm shadow-lift">
              <button onClick={block} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-red-600 hover:bg-red-50">
                <ShieldBan size={16} /> {t("social.block")}
              </button>
              <Link href={`/help?user=${userId}&category=harassment_abuse`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-cream-warm">
                <Flag size={16} /> {t("social.report")}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** "N friends" on a profile; expands into the list when allowed. */
export function UserFriendsList({ userId, count }: { userId: string; count: number }) {
  const { t } = useLanguage();
  const rpc = useSocialRpc();
  const [people, setPeople] = useState<PersonCard[] | null>(null);
  const [open, setOpen] = useState(false);

  async function toggle() {
    setOpen((o) => !o);
    if (!people) setPeople((await rpc<PersonCard[]>("user_friends", { p_user: userId })).data ?? []);
  }

  return (
    <div>
      <button onClick={toggle} disabled={count === 0} className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-orange-dark disabled:hover:text-inherit">
        <Users size={16} /> {t("social.friendsCount", { n: count })}
      </button>
      {open && (
        <div className="mt-2">
          <PeopleList people={people} empty={t("social.noFriendsYet")} />
        </div>
      )}
    </div>
  );
}

const TABS = ["friends", "requests", "find", "suggested"] as const;
type Tab = (typeof TABS)[number];
type Requests = { incoming: PersonCard[]; outgoing: PersonCard[] };

/** Friends, requests, people search and suggestions. */
export function CommunityHub({ initialTab }: { initialTab?: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const rpc = useSocialRpc();
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "friends");
  const [friends, setFriends] = useState<PersonCard[] | null>(null);
  const [requests, setRequests] = useState<Requests | null>(null);
  const [suggested, setSuggested] = useState<PersonCard[] | null>(null);
  const [results, setResults] = useState<PersonCard[] | null>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");

  const loadFriends = useCallback(async () => setFriends((await rpc<PersonCard[]>("my_friends", {})).data ?? []), [rpc]);
  const loadRequests = useCallback(
    async () => setRequests((await rpc<Requests>("my_friend_requests", {})).data ?? { incoming: [], outgoing: [] }),
    [rpc]
  );

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);
  useEffect(() => {
    if (tab === "friends" && !friends) loadFriends();
    if (tab === "suggested" && !suggested) rpc<PersonCard[]>("suggested_people", {}).then((r) => setSuggested(r.data ?? []));
  }, [tab, friends, suggested, loadFriends, rpc]);

  // Debounced people search.
  useEffect(() => {
    if (tab !== "find") return;
    const q = query.trim();
    if (q.replace(/^@/, "").length < 2) {
      setResults([]);
      return;
    }
    setResults(null);
    const id = setTimeout(async () => setResults((await rpc<PersonCard[]>("search_people", { p_query: q })).data ?? []), 350);
    return () => clearTimeout(id);
  }, [query, tab, rpc]);

  function switchTab(next: Tab) {
    setTab(next);
    router.replace(`/community?tab=${next}`, { scroll: false });
  }

  const incoming = requests?.incoming.length ?? 0;
  const q = filter.trim().toLowerCase().replace(/^@/, "");
  const shownFriends = friends?.filter((f) => !q || f.display_name.toLowerCase().includes(q) || f.username.includes(q)) ?? null;

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-full bg-cream-warm p-1 text-sm">
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => switchTab(k)}
            className={cn("flex-1 whitespace-nowrap rounded-full px-3 py-2 font-semibold transition", tab === k ? "bg-surface shadow-soft" : "text-ink/70 hover:text-ink")}
          >
            {t(`social.tab.${k}`)}
            {k === "requests" && incoming > 0 && <span className="ml-1.5 rounded-full bg-orange-deep px-1.5 py-0.5 text-xs text-white">{incoming}</span>}
          </button>
        ))}
      </div>

      <section className="card p-4 sm:p-5">
        {tab === "friends" && (
          <>
            {(friends?.length ?? 0) > 5 && (
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t("social.filterFriends")}
                aria-label={t("social.filterFriends")}
                className="mb-2 w-full rounded-xl border border-ink/10 bg-surface px-3 py-2 text-sm"
              />
            )}
            <PeopleList
              people={shownFriends}
              empty={t("social.noFriends")}
              onChange={(p, next) => next !== "friends" && setFriends((list) => list?.filter((x) => x.user_id !== p.user_id) ?? null)}
            />
          </>
        )}

        {tab === "requests" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-semibold">{t("social.incoming")}</h2>
              <PeopleList
                people={requests?.incoming ?? null}
                empty={t("social.noIncoming")}
                onChange={(p, next) => {
                  setRequests((r) => r && { ...r, incoming: r.incoming.filter((x) => x.user_id !== p.user_id) });
                  if (next === "friends") setFriends(null);
                }}
              />
            </div>
            <div>
              <h2 className="text-sm font-semibold">{t("social.outgoing")}</h2>
              <PeopleList
                people={requests?.outgoing ?? null}
                empty={t("social.noOutgoing")}
                onChange={(p) => setRequests((r) => r && { ...r, outgoing: r.outgoing.filter((x) => x.user_id !== p.user_id) })}
              />
            </div>
          </div>
        )}

        {tab === "find" && (
          <>
            <label className="relative block">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/65" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("social.searchPlaceholder")}
                aria-label={t("social.searchPlaceholder")}
                className="w-full rounded-xl border border-ink/10 bg-surface py-2.5 pl-9 pr-3 text-sm"
              />
            </label>
            {query.trim().replace(/^@/, "").length >= 2 ? (
              <PeopleList people={results} empty={t("social.noResults")} onChange={() => loadRequests()} />
            ) : (
              <p className="py-6 text-center text-sm text-ink/65">{t("social.searchHint")}</p>
            )}
          </>
        )}

        {tab === "suggested" && (
          <>
            <p className="mb-1 text-sm text-ink/70">{t("social.suggestedHint")}</p>
            <PeopleList people={suggested} empty={t("social.noSuggestions")} onChange={() => loadRequests()} />
          </>
        )}
      </section>
    </div>
  );
}
