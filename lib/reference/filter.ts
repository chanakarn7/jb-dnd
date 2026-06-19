// Client-side filter predicates (pure, testable) — all filtering happens in the
// browser over the full per-kind dataset for the <100ms feel (PRD §6.1).
// Name search uses a plain lowercase substring (NOT regex) so special chars are
// treated literally and can never throw (PRD edge 5.7).
import type { SpellListItem, MonsterListItem, ItemListItem } from "./types";

function nameMatches(name: string, q?: string): boolean {
  if (!q) return true;
  return name.toLowerCase().includes(q.trim().toLowerCase());
}

export interface SpellFilters {
  q?: string;
  level?: string; // "" = all; from a <select>, so a string
  school?: string;
  klass?: string;
  ritual?: boolean;
  concentration?: boolean;
}
export function filterSpells(rows: SpellListItem[], f: SpellFilters): SpellListItem[] {
  return rows.filter((s) => {
    if (!nameMatches(s.name, f.q)) return false;
    if (f.level !== undefined && f.level !== "" && String(s.level) !== f.level) return false;
    if (f.school && s.school !== f.school) return false;
    if (f.klass && !s.classes.includes(f.klass)) return false;
    if (f.ritual && !s.ritual) return false;
    if (f.concentration && !s.concentration) return false;
    return true;
  });
}

export interface MonsterFilters {
  q?: string;
  type?: string;
  size?: string;
  crMax?: number;
}
export function filterMonsters(rows: MonsterListItem[], f: MonsterFilters): MonsterListItem[] {
  return rows.filter((m) => {
    if (!nameMatches(m.name, f.q)) return false;
    if (f.type && m.type !== f.type) return false;
    if (f.size && m.size !== f.size) return false;
    if (f.crMax !== undefined && m.crSort > f.crMax) return false;
    return true;
  });
}

export interface ItemFilters {
  q?: string;
  type?: string;
  rarity?: string;
  attune?: boolean;
}
export function filterItems(rows: ItemListItem[], f: ItemFilters): ItemListItem[] {
  return rows.filter((i) => {
    if (!nameMatches(i.name, f.q)) return false;
    if (f.type && i.type !== f.type) return false;
    if (f.rarity && i.rarity !== f.rarity) return false;
    if (f.attune && !i.requiresAttunement) return false;
    return true;
  });
}
