"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Sparkles, Skull, Sword, Search, X, SlidersHorizontal, SearchX, FilterX,
} from "lucide-react";
import { useCampaign } from "../providers";
import { Attribution, rarityChip } from "./_components";
import {
  filterSpells, filterMonsters, filterItems,
  type SpellFilters, type MonsterFilters, type ItemFilters,
} from "@/lib/reference/filter";
import type { SpellListItem, MonsterListItem, ItemListItem } from "@/lib/reference/types";

type Kind = "spells" | "monsters" | "items";
const TABS: { kind: Kind; label: string; Icon: typeof Sparkles }[] = [
  { kind: "spells", label: "Spells", Icon: Sparkles },
  { kind: "monsters", label: "Monsters", Icon: Skull },
  { kind: "items", label: "Items", Icon: Sword },
];

const SCHOOLS = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];
const CLASSES = ["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];
const MONSTER_TYPES = ["aberration", "beast", "celestial", "construct", "dragon", "elemental", "fey", "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant", "undead"];
const SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
const ITEM_TYPES = ["weapon", "armor", "adventuring-gear", "tool", "wondrous", "potion", "ring", "rod", "scroll", "staff", "wand"];
const RARITIES = ["mundane", "common", "uncommon", "rare", "very-rare", "legendary", "artifact"];

type AnyList = SpellListItem[] | MonsterListItem[] | ItemListItem[];

export default function ReferenceClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state } = useCampaign();

  const initialTab = (searchParams.get("tab") as Kind) || "spells";
  const [tab, setTab] = useState<Kind>(TABS.some((t) => t.kind === initialTab) ? initialTab : "spells");

  // Back link follows the live campaign session; after a hard refresh (no live
  // state) it falls back to the landing page.
  const backHref = state?.campaignId ? `/campaign/${state.campaignId}` : "/";
  const [cache, setCache] = useState<Partial<Record<Kind, AnyList>>>({});
  const loading = cache[tab] === undefined; // derived — no setState-in-effect
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filters, setFilters] = useState<Record<string, string | boolean>>({});
  const [mobileFilters, setMobileFilters] = useState(false);

  // Guard: must have joined a campaign (a stored seat or a live session).
  // Reference is in-session only (PRD §2.2 / edge 5.8).
  useEffect(() => {
    if (state?.campaignId) return;
    let hasSeat = false;
    try {
      hasSeat = Object.keys(JSON.parse(localStorage.getItem("dnd.sessions") ?? "{}")).length > 0;
    } catch {
      hasSeat = false;
    }
    if (!hasSeat) router.replace("/join");
  }, [router, state?.campaignId]);

  // Debounce search input (PRD: don't filter per keystroke jank).
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 150);
    return () => clearTimeout(id);
  }, [q]);

  // Fetch the active tab's dataset once, then filter in memory.
  useEffect(() => {
    if (cache[tab]) return;
    let alive = true;
    fetch(`/api/reference/${tab}`)
      .then((r) => r.json())
      .then((data: AnyList) => alive && setCache((c) => ({ ...c, [tab]: data })))
      .catch(() => alive && setCache((c) => ({ ...c, [tab]: [] }))); // resolve to empty, not an endless spinner
    return () => {
      alive = false;
    };
  }, [tab, cache]);

  function switchTab(next: Kind) {
    setTab(next);
    setQ("");
    setDebouncedQ("");
    setFilters({});
    setMobileFilters(false);
    router.replace(`/reference?tab=${next}`, { scroll: false });
  }

  const rows = cache[tab];
  const filtered = useMemo(() => {
    if (!rows) return [] as AnyList;
    if (tab === "spells") {
      const f: SpellFilters = {
        q: debouncedQ,
        level: (filters.level as string) ?? "",
        school: (filters.school as string) ?? "",
        klass: (filters.class as string) ?? "",
        ritual: !!filters.ritual,
        concentration: !!filters.concentration,
      };
      return filterSpells(rows as SpellListItem[], f);
    }
    if (tab === "monsters") {
      const f: MonsterFilters = {
        q: debouncedQ,
        type: (filters.type as string) ?? "",
        size: (filters.size as string) ?? "",
        crMax: filters.crMax !== undefined && filters.crMax !== "" ? Number(filters.crMax) : undefined,
      };
      return filterMonsters(rows as MonsterListItem[], f);
    }
    const f: ItemFilters = {
      q: debouncedQ,
      type: (filters.type as string) ?? "",
      rarity: (filters.rarity as string) ?? "",
      attune: !!filters.attune,
    };
    return filterItems(rows as ItemListItem[], f);
  }, [rows, tab, debouncedQ, filters]);

  const activeFilterCount = Object.values(filters).filter((v) => v === true || (typeof v === "string" && v !== "")).length;
  const setF = (k: string, v: string | boolean) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <main className="min-h-dvh max-w-5xl mx-auto p-4 sm:p-6">
      <Link href={backHref} className="text-muted hover:text-text text-sm flex items-center gap-1 mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" aria-hidden /> Back to campaign
      </Link>
      <h1 className="font-display text-3xl text-accent mb-5">Reference</h1>

      {/* tabs */}
      <div role="tablist" aria-label="Reference categories" className="flex gap-1 border-b border-border mb-4">
        {TABS.map(({ kind, label, Icon }) => {
          const active = tab === kind;
          return (
            <button
              key={kind}
              role="tab"
              aria-selected={active}
              onClick={() => switchTab(kind)}
              className={`px-4 py-2.5 text-sm flex items-center gap-2 border-b-2 -mb-px transition ${
                active ? "text-text border-accent" : "text-muted border-transparent hover:text-text"
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden /> {label}
            </button>
          );
        })}
      </div>

      {/* search + mobile filter toggle */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${tab}…`}
            aria-label={`Search ${tab}`}
            autoComplete="off"
            className="w-full rounded-md bg-surface border border-border pl-9 pr-9 py-2.5 text-sm placeholder:text-faint"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setMobileFilters((v) => !v)}
          className="sm:hidden rounded-md border border-border bg-surface px-3 text-sm text-muted flex items-center gap-1.5"
          aria-expanded={mobileFilters}
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden /> {activeFilterCount ? `(${activeFilterCount})` : ""}
        </button>
      </div>

      {/* filter bar */}
      <div className={`${mobileFilters ? "flex" : "hidden"} sm:flex flex-wrap items-center gap-2 mb-4 p-3 rounded-md bg-surface border border-border`}>
        {tab === "spells" && (
          <>
            <Select value={(filters.level as string) ?? ""} onChange={(v) => setF("level", v)} all="All levels"
              options={[{ v: "0", l: "Cantrip" }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ v: String(n), l: `Level ${n}` }))]} />
            <Select value={(filters.school as string) ?? ""} onChange={(v) => setF("school", v)} all="All schools" options={SCHOOLS.map((s) => ({ v: s, l: s }))} />
            <Select value={(filters.class as string) ?? ""} onChange={(v) => setF("class", v)} all="All classes" options={CLASSES.map((s) => ({ v: s, l: s }))} />
            <Toggle label="Ritual" checked={!!filters.ritual} onChange={(v) => setF("ritual", v)} />
            <Toggle label="Concentration" checked={!!filters.concentration} onChange={(v) => setF("concentration", v)} />
          </>
        )}
        {tab === "monsters" && (
          <>
            <Select value={(filters.type as string) ?? ""} onChange={(v) => setF("type", v)} all="All types" options={MONSTER_TYPES.map((s) => ({ v: s, l: s }))} />
            <Select value={(filters.size as string) ?? ""} onChange={(v) => setF("size", v)} all="All sizes" options={SIZES.map((s) => ({ v: s, l: s }))} />
            <label className="flex items-center gap-2 text-sm text-muted px-2.5 py-1.5 rounded-md border border-border">
              CR ≤
              <input
                type="range" min={0} max={30} step={1}
                value={filters.crMax !== undefined && filters.crMax !== "" ? Number(filters.crMax) : 30}
                onChange={(e) => setF("crMax", e.target.value === "30" ? "" : e.target.value)}
                className="accent-accent w-28" aria-label="Maximum challenge rating"
              />
              <span className="font-mono tnum text-text w-6">{filters.crMax !== undefined && filters.crMax !== "" ? String(filters.crMax) : "30"}</span>
            </label>
          </>
        )}
        {tab === "items" && (
          <>
            <Select value={(filters.type as string) ?? ""} onChange={(v) => setF("type", v)} all="All types" options={ITEM_TYPES.map((s) => ({ v: s, l: s.replace(/-/g, " ") }))} />
            <Select value={(filters.rarity as string) ?? ""} onChange={(v) => setF("rarity", v)} all="All rarities" options={RARITIES.map((s) => ({ v: s, l: s.replace(/-/g, " ") }))} />
            <Toggle label="Requires attunement" checked={!!filters.attune} onChange={(v) => setF("attune", v)} />
          </>
        )}
        {activeFilterCount > 0 && (
          <button onClick={() => setFilters({})} className="ml-auto text-sm text-muted hover:text-text flex items-center gap-1">
            <X className="w-3.5 h-3.5" aria-hidden /> Clear filters
          </button>
        )}
      </div>

      <p className="text-sm text-muted tnum mb-3">{loading ? "กำลังโหลด…" : `พบ ${filtered.length} รายการ`}</p>

      {/* results / states */}
      {loading ? (
        <ul className="space-y-2" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="h-16 rounded-md bg-surface border border-border animate-pulse" />
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        debouncedQ ? (
          <EmptyState Icon={SearchX} msg={<>ไม่พบ &quot;<span className="text-text">{debouncedQ}</span>&quot; — ลองคำอื่น</>} action={{ label: "Clear search", onClick: () => setQ("") }} />
        ) : (
          <EmptyState Icon={FilterX} msg="ไม่มีรายการตรงกับฟิลเตอร์" action={{ label: "Clear filters", onClick: () => setFilters({}) }} />
        )
      ) : (
        <ul className="space-y-2">
          {tab === "spells" && (filtered as SpellListItem[]).map((s) => <SpellRow key={s.slug} s={s} />)}
          {tab === "monsters" && (filtered as MonsterListItem[]).map((m) => <MonsterRow key={m.slug} m={m} />)}
          {tab === "items" && (filtered as ItemListItem[]).map((it) => <ItemRow key={it.slug} it={it} />)}
        </ul>
      )}

      <Attribution />
    </main>
  );
}

// ---------- small controls ----------
function Select({ value, onChange, all, options }: { value: string; onChange: (v: string) => void; all: string; options: { v: string; l: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md bg-bg border border-border px-2.5 py-1.5 text-sm text-muted">
      <option value="">{all}</option>
      {options.map((o) => (
        <option key={o.v} value={o.v}>{o.l}</option>
      ))}
    </select>
  );
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-muted px-2.5 py-1.5 rounded-md border border-border cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-accent" />
      {label}
    </label>
  );
}
function EmptyState({ Icon, msg, action }: { Icon: typeof SearchX; msg: React.ReactNode; action: { label: string; onClick: () => void } }) {
  return (
    <div className="text-center py-16">
      <Icon className="w-8 h-8 text-faint mx-auto" aria-hidden />
      <p className="mt-3 text-muted">{msg}</p>
      <button onClick={action.onClick} className="mt-4 rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-raised">{action.label}</button>
    </div>
  );
}

// ---------- rows ----------
function SpellRow({ s }: { s: SpellListItem }) {
  return (
    <li>
      <Link href={`/reference/spells/${s.slug}`} className="block rounded-md border border-border bg-surface px-4 py-3 hover:bg-surface-raised">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-arcane mt-1 shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{s.name}</span>
              <span className="text-xs rounded-full px-2 py-0.5 border border-accent/50 text-accent font-mono tnum">{s.level === 0 ? "Cantrip" : `Lvl ${s.level}`}</span>
              <span className="text-xs rounded-full px-2 py-0.5 border border-arcane/50 text-arcane">{s.school}</span>
              {s.ritual && <span className="text-xs text-muted">ritual</span>}
              {s.concentration && <span className="text-xs text-muted">conc.</span>}
            </div>
            <div className="text-sm text-muted mt-0.5">{s.castingTime}{s.classes.length ? ` · ${s.classes.join(", ")}` : ""}</div>
          </div>
        </div>
      </Link>
    </li>
  );
}
function MonsterRow({ m }: { m: MonsterListItem }) {
  return (
    <li>
      <Link href={`/reference/monsters/${m.slug}`} className="block rounded-md border border-border bg-surface px-4 py-3 hover:bg-surface-raised">
        <div className="flex items-center gap-2">
          <Skull className="w-4 h-4 text-muted shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <div className="font-medium">{m.name}</div>
            <div className="text-sm text-muted capitalize">{m.size} {m.type}</div>
          </div>
          <div className="text-sm font-mono tnum text-muted whitespace-nowrap">CR {m.cr} · HP {m.hp} · AC {m.ac}</div>
        </div>
      </Link>
    </li>
  );
}
function ItemRow({ it }: { it: ItemListItem }) {
  return (
    <li>
      <Link href={`/reference/items/${it.slug}`} className="block rounded-md border border-border bg-surface px-4 py-3 hover:bg-surface-raised">
        <div className="flex items-center gap-2 flex-wrap">
          <Sword className="w-4 h-4 text-muted shrink-0" aria-hidden />
          <span className="font-medium">{it.name}</span>
          <span className="text-xs rounded-full px-2 py-0.5 border border-border text-muted capitalize">{it.type.replace(/-/g, " ")}</span>
          <span className={`text-xs rounded-full px-2 py-0.5 border ${rarityChip(it.rarity)}`}>{it.rarity.replace(/-/g, " ")}</span>
          {it.requiresAttunement && <span className="text-xs text-accent">◈ attunement</span>}
        </div>
      </Link>
    </li>
  );
}
