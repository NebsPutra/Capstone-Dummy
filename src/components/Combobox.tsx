"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeSearch, stripRegionPrefix } from "@/lib/wilayah";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export interface ComboOption {
  id: string;
  label: string;
  /** Extra words that should also match (e.g. the official Indonesian name). */
  keywords?: string;
  /** Lower sorts first among equally good matches (e.g. cities before regencies). */
  group?: number;
}

type IndexedOption = ComboOption & { norm: string; hay: string };

export function indexOptions(options: ComboOption[]): IndexedOption[] {
  return options.map((o) => ({
    ...o,
    // Rank on the name without "Kota"/"Kabupaten", so "bek" treats
    // "Kota Bekasi" as a starts-with match.
    norm: normalizeSearch(stripRegionPrefix(o.label)),
    hay: normalizeSearch(`${o.label} ${o.keywords ?? ""}`),
  }));
}

/**
 * Case/accent-insensitive search: every typed word must appear somewhere in
 * the option. Ranked: name starts with the query, then a word in the name
 * starts with it, then any other match; ties by `group`, then name.
 */
export function searchOptions(
  indexed: IndexedOption[],
  normalizedQuery: string,
  maxResults: number
): { results: ComboOption[]; more: boolean } {
  const q = normalizedQuery;
  const tokens = q ? q.split(" ") : [];
  const matched = indexed
    .filter((o) => tokens.every((tok) => o.hay.includes(tok)))
    .map((o) => ({
      o,
      score: !q ? 0 : o.norm.startsWith(q) ? 0 : o.norm.split(" ").some((w) => w.startsWith(tokens[0])) ? 1 : 2,
    }))
    .sort(
      (a, b) => a.score - b.score || (a.o.group ?? 0) - (b.o.group ?? 0) || a.o.label.localeCompare(b.o.label, "id")
    );
  return { results: matched.slice(0, maxResults).map((m) => m.o), more: matched.length > maxResults };
}

/**
 * Searchable single-select (ARIA combobox pattern). Only options from the
 * list can be chosen — typed text is never submitted as a value.
 *
 * `minChars` > 0 keeps long lists (hundreds of cities) closed until the user
 * has typed enough to narrow them; short lists show everything on open.
 */
export function Combobox({
  id,
  label,
  placeholder,
  options,
  value,
  onChange,
  loading,
  disabled,
  disabledHint,
  error,
  minChars = 0,
  maxResults = 50,
  noResults,
}: {
  id: string;
  label: string;
  placeholder: string;
  options: ComboOption[];
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
  disabled?: boolean;
  /** Shown in the empty field while disabled, e.g. "Select a city first". */
  disabledHint?: string;
  error?: string | null;
  minChars?: number;
  maxResults?: number;
  noResults: string;
}) {
  const { t } = useLanguage();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.id === value) ?? null;

  const indexed = useMemo(() => indexOptions(options), [options]);
  const q = normalizeSearch(query);
  const tooShort = q.length < minChars;
  const { results, more } = useMemo(
    () => (tooShort ? { results: [], more: false } : searchOptions(indexed, q, maxResults)),
    [indexed, q, tooShort, maxResults]
  );

  useEffect(() => setActive(0), [q, open]);

  // Keep the highlighted option visible while arrowing through the list.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function openList() {
    if (disabled || open) return;
    setOpen(true);
    setQuery("");
    // On phones, bring the field to the top so the on-screen keyboard
    // doesn't hide the results.
    if (window.matchMedia("(max-width: 639px)").matches) {
      setTimeout(() => inputRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 250);
    }
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  function choose(optionId: string) {
    onChange(optionId);
    close();
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault(); // never submit the surrounding form from here
      if (results[active]) choose(results[active].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close();
    }
  }

  const showClear = Boolean(selected) && !disabled && !open;
  const activeId = open && results[active] ? `${listId}-opt-${active}` : undefined;

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35"
          aria-hidden
        />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-invalid={Boolean(error) || undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          value={open ? query : selected?.label ?? ""}
          placeholder={disabled ? disabledHint ?? "—" : placeholder}
          onFocus={openList}
          onClick={openList}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onBlur={close}
          onKeyDown={onKeyDown}
          className={cn(
            // 16px text on mobile stops iOS from zooming into the field.
            "w-full rounded-xl border bg-surface py-3 pl-10 pr-10 text-base outline-none transition focus:border-orange disabled:cursor-not-allowed disabled:bg-cream-warm disabled:opacity-60 sm:py-2.5 sm:text-sm",
            error ? "border-red-400 bg-red-50/40" : "border-ink/10"
          )}
        />
        {loading ? (
          <span className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-ink/15 border-t-orange" />
        ) : showClear ? (
          <button
            type="button"
            aria-label={`${t("location.clear")} ${label}`}
            // mousedown (not click) so the input doesn't blur/refocus first
            onMouseDown={(e) => {
              e.preventDefault();
              onChange("");
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink/40 hover:bg-cream-warm hover:text-ink/70"
          >
            <X size={16} />
          </button>
        ) : (
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink/35"
            aria-hidden
          />
        )}
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-lg">
          {loading ? (
            <p className="px-4 py-3 text-sm text-ink/50">{t("common.loading")}</p>
          ) : tooShort ? (
            <p className="px-4 py-3 text-sm text-ink/50">{t("location.typeMin", { n: minChars })}</p>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm">
              <p className="font-medium">{noResults}</p>
              <p className="text-ink/50">{t("location.tryAnother")}</p>
            </div>
          ) : (
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={label}
              className="max-h-[min(18rem,50vh)] overflow-y-auto overscroll-contain py-1"
            >
              {results.map((o, i) => (
                <li
                  key={o.id}
                  id={`${listId}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={o.id === value}
                  // mousedown + preventDefault keeps focus in the input, so
                  // blur doesn't close the list before the tap registers.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o.id)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex min-h-[44px] cursor-pointer items-center px-4 py-2.5 text-base sm:min-h-0 sm:text-sm",
                    i === active && "bg-orange/10",
                    o.id === value && "font-semibold text-orange-dark"
                  )}
                >
                  {o.label}
                </li>
              ))}
              {more && <li className="px-4 py-2 text-xs text-ink/40">{t("location.moreResults")}</li>}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
