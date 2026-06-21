"use client";
// File: components/GlobalSearch.tsx
// Inline search in campaign header. Icon → input expands → debounced GET /api/search.
// Results grouped by type with type badges. ESC or click-outside closes.

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import type { SearchResults, SearchResultItem } from "@/lib/player-ui/types";

const TYPE_BADGE: Record<SearchResultItem["type"], { label: string; cls: string }> = {
  spell:     { label: "Spell",   cls: "bg-arcane/20 text-arcane" },
  item:      { label: "Item",    cls: "bg-accent/20 text-accent" },
  monster:   { label: "Monster", cls: "bg-arcane/20 text-arcane" },
  character: { label: "Char",    cls: "bg-surface-raised text-muted" },
  quest:     { label: "Quest",   cls: "bg-accent/20 text-accent" },
  npc:       { label: "NPC",     cls: "bg-surface-raised text-muted" },
  journal:   { label: "Journal", cls: "bg-surface-raised text-muted" },
};

const SECTION_ORDER: Array<{ key: keyof SearchResults; label: string }> = [
  { key: "spells",         label: "Spells" },
  { key: "items",          label: "Items" },
  { key: "monsters",       label: "Monsters" },
  { key: "characters",     label: "Characters" },
  { key: "quests",         label: "Quests" },
  { key: "npcs",           label: "NPCs" },
  { key: "journalEntries", label: "Journal" },
];

interface Props {
  sessionToken: string;
  onNavigate?: (item: SearchResultItem) => void;
}

export default function GlobalSearch({ sessionToken, onNavigate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = () => {
    setExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const close = useCallback(() => {
    setExpanded(false);
    setQuery("");
    setResults(null);
    setNoResults(false);
  }, []);

  // ESC closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  // Click outside closes
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    if (expanded) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [expanded, close]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); setNoResults(false); return; }
    setLoading(true);
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    setLoading(false);
    if (!res.ok) return;
    const body = (await res.json()) as { results: SearchResults };
    const r = body.results;
    const total = Object.values(r).reduce((sum, arr) => sum + arr.length, 0);
    setResults(r);
    setNoResults(total === 0);
  }, [sessionToken]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 300);
  };

  const handleSelect = (item: SearchResultItem) => {
    onNavigate?.(item);
    close();
  };

  const hasResults = results && Object.values(results).some((arr) => arr.length > 0);

  return (
    <div ref={containerRef} className="relative flex items-center">
      {!expanded ? (
        <button onClick={open} aria-label="Open search" className="text-muted hover:text-accent transition-colors">
          <Search className="w-4 h-4" />
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleChange}
              placeholder="Search spells, items, quests…"
              className="w-64 pl-7 pr-3 py-1.5 rounded-md border border-border bg-bg text-sm focus:border-accent focus:outline-none"
              aria-label="Search campaign"
              aria-expanded={hasResults || noResults || loading}
              aria-controls="search-dropdown"
              role="combobox"
            />
          </div>
          <button onClick={close} aria-label="Close search" className="text-muted hover:text-text">
            <X className="w-4 h-4" />
          </button>

          {/* Dropdown */}
          {(loading || hasResults || noResults) && (
            <div
              id="search-dropdown"
              role="listbox"
              className="absolute top-full right-0 mt-1 w-80 rounded-lg border border-border bg-surface-raised shadow-2xl z-50 max-h-96 overflow-y-auto"
            >
              {loading && (
                <div className="p-4 space-y-2 animate-pulse">
                  {[1, 2, 3].map((i) => <div key={i} className="h-4 rounded bg-surface w-4/5" />)}
                </div>
              )}
              {!loading && noResults && (
                <p className="text-sm text-muted text-center py-6">No results for &apos;{query}&apos;</p>
              )}
              {!loading && hasResults && SECTION_ORDER.map(({ key, label }) => {
                const items = results![key];
                if (items.length === 0) return null;
                return (
                  <div key={key}>
                    <p className="font-display text-[10px] uppercase tracking-widest text-faint px-3 pt-3 pb-1">{label}</p>
                    {items.map((item) => {
                      const badge = TYPE_BADGE[item.type];
                      return (
                        <button
                          key={item.id}
                          role="option"
                          aria-selected={false}
                          onClick={() => handleSelect(item)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface transition-colors"
                        >
                          <span className={`shrink-0 text-[10px] rounded px-1.5 py-0.5 ${badge.cls}`}>{badge.label}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text truncate">{item.name}</p>
                            <p className="text-xs text-muted truncate">{item.hint}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Typing prompt */}
          {!loading && !hasResults && !noResults && query.length > 0 && query.length < 2 && (
            <div className="absolute top-full right-0 mt-1 w-64 rounded-lg border border-border bg-surface-raised px-4 py-3 text-xs text-muted z-50">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      )}
    </div>
  );
}
