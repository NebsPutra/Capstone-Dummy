"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  Crown,
  Download,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  MapPinned,
  MessageSquareWarning,
  Search,
  Settings,
  ShieldCheck,
  Tags,
  Users,
  UsersRound,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";
import { Logo } from "../Logo";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { ThemeToggle } from "../ThemeToggle";

type NavItem = { href: string; key: TranslationKey; icon: typeof Users; minRank: number };
const GROUPS: { key: TranslationKey; items: NavItem[] }[] = [
  {
    key: "admin.nav.group.overview",
    items: [
      { href: "/admin", key: "admin.nav.dashboard", icon: LayoutDashboard, minRank: 1 },
      { href: "/admin/analytics", key: "admin.nav.analytics", icon: BarChart3, minRank: 1 },
      { href: "/admin/notifications", key: "admin.nav.notifications", icon: Bell, minRank: 1 },
    ],
  },
  {
    key: "admin.nav.group.manage",
    items: [
      { href: "/admin/users", key: "admin.nav.users", icon: Users, minRank: 1 },
      { href: "/admin/events", key: "admin.nav.events", icon: CalendarDays, minRank: 1 },
      { href: "/admin/participants", key: "admin.nav.participants", icon: UsersRound, minRank: 1 },
      { href: "/admin/hobbies", key: "admin.nav.hobbies", icon: Sparkles, minRank: 1 },
      { href: "/admin/categories", key: "admin.nav.categories", icon: Tags, minRank: 1 },
      { href: "/admin/locations", key: "admin.nav.locations", icon: MapPinned, minRank: 1 },
    ],
  },
  {
    key: "admin.nav.group.support",
    items: [{ href: "/admin/complaints", key: "admin.nav.complaints", icon: MessageSquareWarning, minRank: 1 }],
  },
  {
    key: "admin.nav.group.system",
    items: [
      { href: "/admin/export", key: "admin.nav.export", icon: Download, minRank: 2 },
      { href: "/admin/audit", key: "admin.nav.audit", icon: ClipboardList, minRank: 2 },
      { href: "/admin/data-quality", key: "admin.nav.dataQuality", icon: Gauge, minRank: 1 },
      { href: "/admin/health", key: "admin.nav.health", icon: HeartPulse, minRank: 2 },
      { href: "/admin/settings", key: "admin.nav.settings", icon: Settings, minRank: 2 },
    ],
  },
];

interface SearchHit {
  type: "user" | "event" | "complaint" | "category" | "location";
  id: string;
  title: string;
  subtitle: string;
  exact: boolean;
}

function hrefFor(h: SearchHit) {
  switch (h.type) {
    case "user":
      return `/admin/users/${h.id}`;
    case "event":
      return `/admin/events/${h.id}`;
    case "complaint":
      return `/admin/complaints/${h.id}`;
    case "category":
      return "/admin/categories";
    default:
      return "/admin/locations";
  }
}

function GlobalSearch() {
  const { t } = useLanguage();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) return setHits([]);
    timer.current = setTimeout(async () => {
      const { data } = await createClient().rpc("admin_search", { p_q: q });
      setHits((data as SearchHit[]) ?? []);
    }, 250);
  }, [q]);

  return (
    <div className="relative w-full max-w-md">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          // Exact reference (EVT-…, CPL-…) jumps straight to the record.
          if (e.key === "Enter" && hits[0]) {
            router.push(hrefFor(hits[0]));
            setOpen(false);
          }
        }}
        placeholder={t("admin.searchPlaceholder")}
        aria-label={t("admin.searchPlaceholder")}
        className="w-full rounded-full border border-ink/10 bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-orange"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-96 overflow-auto rounded-xl border border-ink/10 bg-surface py-1 shadow-lg">
          {hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink/50">{t("admin.searchNoResults")}</p>
          ) : (
            hits.map((h) => (
              <Link
                key={`${h.type}-${h.id}-${h.subtitle}`}
                href={hrefFor(h)}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-cream-warm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{h.title}</span>
                  <span className="block truncate text-xs text-ink/50">{h.subtitle}</span>
                </span>
                <span className="shrink-0 rounded-full bg-cream-warm px-2 py-0.5 text-[10px] font-semibold uppercase text-ink/50">
                  {t(`admin.searchType.${h.type}`)}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function AdminShell({ rank, role, children }: { rank: number; role: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => rank >= i.minRank) })).filter((g) => g.items.length);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname?.startsWith(href));

  return (
    <div className="flex min-h-screen bg-cream">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink/5 bg-surface lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <Logo size={28} />
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink/35">{t(g.key)}</p>
              {g.items.map(({ href, key, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition active:scale-[0.98]",
                    isActive(href) ? "bg-orange text-white shadow-soft" : "text-ink/70 hover:bg-cream-warm"
                  )}
                >
                  <Icon size={17} className="shrink-0" />
                  {t(key)}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <Link href="/dashboard" className="border-t border-ink/5 px-5 py-4 text-sm font-medium text-orange-dark">
          {t("admin.backToApp")}
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 space-y-2 border-b border-ink/5 bg-surface/80 px-4 py-3 backdrop-blur-md md:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="lg:hidden">
              <Logo size={26} wordmark={false} />
            </Link>
            <GlobalSearch />
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "hidden items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex",
                  role === "super_admin" ? "bg-gradient-to-r from-orange to-amber-400 text-white" : "bg-cream-warm text-ink/70"
                )}
              >
                {role === "super_admin" ? <Crown size={13} /> : <ShieldCheck size={13} />}
                {role === "super_admin" ? t("admin.godMode") : t(`role.${role}` as TranslationKey)}
              </span>
              <div className="hidden md:block">
                <ThemeToggle compact />
              </div>
              <LanguageSwitcher />
            </div>
          </div>
          {/* Compact nav for tablets/phones */}
          <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:hidden">
            {groups.flatMap((g) => g.items).map(({ href, key, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                  isActive(href) ? "bg-orange text-white" : "bg-cream-warm text-ink/70"
                )}
              >
                <Icon size={14} />
                {t(key)}
              </Link>
            ))}
            <Link href="/dashboard" className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-orange-dark">
              <Activity size={14} /> {t("admin.backToApp")}
            </Link>
          </nav>
        </header>
        <main className="flex-1 space-y-6 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
